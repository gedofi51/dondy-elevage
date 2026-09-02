import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LayerBatch, type LayerBatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { computeLotRemaining } from '../egg-stock/calculations/egg-stock-lot.calculations';
import { computeLayerCurrentHeadcount } from './calculations/layer-headcount.calculations';
import { computeLayingRatePercent } from './calculations/layer-eggs.calculations';
import { computeCostPerEggFcfa } from './calculations/layer-finance.calculations';
import {
  computeGrossMarginFcfa,
  computeRevenueFcfa,
  computeTotalExpensesFcfa,
} from '../broiler-batches/calculations/broiler-finance.calculations';
import {
  buildLayerForecast,
  FORECAST_WINDOW_DAYS,
  type LayerForecast,
} from './calculations/layer-forecast.calculations';
import type { CreateLayerBatchDto } from './dto/create-layer-batch.dto';
import type { UpdateLayerBatchDto } from './dto/update-layer-batch.dto';

const CODE_PREFIX_BASE = 'PON';
const CODE_DIGITS = 3;
const MAX_CODE_RETRIES = 3;
/** Prévisions production (Lot 3) — REFORME/CLOTURE/ANNULEE (cycle
 * terminé) exclus de GET /layer-batches/previsions, même principe que
 * PROJECTABLE_BROILER_STATUSES — voir DETTE_TECHNIQUE.md. */
const PROJECTABLE_LAYER_STATUSES: LayerBatchStatus[] = ['ELEVAGE', 'PONTE'];
/** Ventes non annulées uniquement — même logique que CONFIRMED_SALE_STATUSES
 * côté SalesService/BroilerBatchesService, dupliquée localement (constante
 * simple, cohérent avec le style déjà en place dans ce codebase). */
const NON_CANCELLED_SALE_STATUSES: Prisma.SaleWhereInput['status'] = { not: 'ANNULEE' };

export interface LayerBatchWithComputed extends LayerBatch {
  currentHeadcount: number;
}

export interface LayerBatchClosureSummary {
  production: {
    initialQuantity: number;
    currentHeadcount: number;
    cumulativeEggsLaid: number;
    cumulativeEggsSellable: number;
    cumulativeEggsSold: number;
    averageLayingRatePercent: number;
    daysTracked: number;
  };
  stock: {
    /** Non bloquant pour la clôture — signalé si non nul, voir plan Phase 4. */
    remainingEggStock: number;
  };
  finances: {
    totalExpensesFcfa: number;
    revenueFcfa: number;
    grossMarginFcfa: number;
    costPerEggFcfa: number;
  };
  coherence: {
    /** henCount de la dernière journée saisie (inclut les éventuels
     * "ajustements contrôlés" manuels) vs effectif purement calculé depuis
     * le cumul mortalité/réforme/autres sorties — divergence = drift entre
     * recomptages physiques et suivi théorique, signalée sans jamais
     * bloquer la clôture (§17, même philosophie que Phase 3). */
    lastRecordedHenCount: number | null;
    computedHeadcount: number;
    isCoherent: boolean;
  };
}

@Injectable()
export class LayerBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Dérivé du dernier code émis pour la ferme+année (PON-AAAA-NNN), avec
   * retry sur conflit P2002 — pattern CustomersService.generateCode (le plus
   * sûr des deux déjà en place dans ce codebase, contrairement à
   * BroilerBatchesService.generateBatchCode qui n'a pas de retry). */
  private async generateBatchCode(farmId: string, year: number): Promise<string> {
    const prefix = `${CODE_PREFIX_BASE}-${year}-`;
    const last = await this.prisma.layerBatch.findFirst({
      where: { farmId, code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  private async assertReferencesBelongToFarm(
    farmId: string,
    refs: { buildingId?: string; primaryManagerId?: string },
  ): Promise<void> {
    if (refs.buildingId) {
      const building = await this.prisma.building.findUnique({ where: { id: refs.buildingId } });
      if (!building || building.farmId !== farmId) {
        throw new NotFoundException('Bâtiment introuvable.');
      }
    }
    if (refs.primaryManagerId) {
      const manager = await this.prisma.user.findUnique({ where: { id: refs.primaryManagerId } });
      if (!manager || manager.farmId !== farmId) {
        throw new NotFoundException('Responsable introuvable.');
      }
    }
  }

  private async computeCurrentHeadcount(batchId: string, initialQuantity: number): Promise<number> {
    const dailyAgg = await this.prisma.layerDailyRecord.aggregate({
      where: { batchId },
      _sum: { mortalityQuantity: true, cullsQuantity: true, otherExitsQuantity: true },
    });
    return computeLayerCurrentHeadcount(
      initialQuantity,
      dailyAgg._sum.mortalityQuantity ?? 0,
      dailyAgg._sum.cullsQuantity ?? 0,
      dailyAgg._sum.otherExitsQuantity ?? 0,
    );
  }

  private async attachComputedFields(batch: LayerBatch): Promise<LayerBatchWithComputed> {
    const currentHeadcount = await this.computeCurrentHeadcount(batch.id, batch.initialQuantity);
    return { ...batch, currentHeadcount };
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateLayerBatchDto,
    ipAddress: string | null,
  ): Promise<LayerBatchWithComputed> {
    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      buildingId: dto.buildingId,
      primaryManagerId: dto.primaryManagerId,
    });

    const entryDate = new Date(dto.entryDate);

    let batch: LayerBatch | undefined;
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateBatchCode(actingUser.farmId, entryDate.getFullYear());
      try {
        batch = await this.prisma.layerBatch.create({
          data: {
            farmId: actingUser.farmId,
            code,
            strain: dto.strain,
            entryDate,
            initialQuantity: dto.initialQuantity,
            ageAtEntryWeeks: dto.ageAtEntryWeeks,
            ageAtEntryDays: dto.ageAtEntryDays,
            buildingId: dto.buildingId,
            primaryManagerId: dto.primaryManagerId,
            observations: dto.observations,
            createdBy: actingUser.sub,
          },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }
    if (!batch) {
      throw new ConflictException('Impossible de générer un code de lot unique — réessayer.');
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'layer_batch',
      entityId: batch.id,
      action: 'LAYER_BATCH_CREATED',
      newValues: {
        code: batch.code,
        initialQuantity: batch.initialQuantity,
        buildingId: batch.buildingId,
      },
      ipAddress,
    });

    return this.attachComputedFields(batch);
  }

  async findAll(actingUser: AccessTokenPayload): Promise<LayerBatchWithComputed[]> {
    const batches = await this.prisma.layerBatch.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(batches.map((batch) => this.attachComputedFields(batch)));
  }

  /**
   * Prévisions production (Lot 3) — GET /layer-batches/previsions. Une
   * requête par lot (même précédent que findAll()/computeCurrentHeadcount
   * ci-dessus). Délégation à buildLayerForecast() (pure, testée
   * séparément) pour l'arithmétique.
   */
  async findAllForecast(actingUser: AccessTokenPayload): Promise<LayerForecast[]> {
    const batches = await this.prisma.layerBatch.findMany({
      where: { farmId: actingUser.farmId, status: { in: PROJECTABLE_LAYER_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setUTCDate(windowStart.getUTCDate() - FORECAST_WINDOW_DAYS);

    return Promise.all(
      batches.map(async (batch) => {
        const [currentHeadcount, agg] = await Promise.all([
          this.computeCurrentHeadcount(batch.id, batch.initialQuantity),
          this.prisma.layerDailyRecord.aggregate({
            where: { batchId: batch.id, date: { gte: windowStart } },
            _sum: { eggsLaid: true },
            _count: { _all: true },
          }),
        ]);

        return buildLayerForecast(
          {
            batchId: batch.id,
            totalEggsLaidInWindow: agg._sum.eggsLaid ?? 0,
            recordDaysInWindow: agg._count._all,
            currentHeadcount,
          },
          now,
        );
      }),
    );
  }

  /** Usage interne (update/remove/annuler/clôturer) : pas de champs calculés. */
  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<LayerBatch> {
    const batch = await this.prisma.layerBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Lot introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
    return batch;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<LayerBatchWithComputed> {
    const batch = await this.getRaw(actingUser, id);
    return this.attachComputedFields(batch);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateLayerBatchDto,
    ipAddress: string | null,
  ): Promise<LayerBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      buildingId: dto.buildingId,
      primaryManagerId: dto.primaryManagerId,
    });

    const updated = await this.prisma.layerBatch.update({
      where: { id },
      data: { ...dto, entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'layer_batch',
      entityId: id,
      action: 'LAYER_BATCH_UPDATED',
      oldValues: { status: existing.status, initialQuantity: existing.initialQuantity },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputedFields(updated);
  }

  /**
   * Suppression définitive — uniquement si le lot n'a AUCUNE journée de
   * ponte saisie (contrairement à BroilerBatchesService.remove : ici les
   * LayerDailyRecord ne sont jamais des placeholders auto-générés, ce sont
   * des données de production substantielles, potentiellement déjà sources
   * d'un EggStockLot consommé par des ventes — les qualifier de
   * "supprimables avec le lot" serait risqué). Ni Expense/Sale/
   * LayerHealthEvent liés. Dans tous les autres cas : POST /:id/annuler.
   */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.getRaw(actingUser, id);

    const [expenseCount, saleCount, healthEventCount, dailyRecordCount] = await Promise.all([
      this.prisma.expense.count({ where: { layerBatchId: id, deletedAt: null } }),
      this.prisma.sale.count({ where: { layerBatchId: id } }),
      this.prisma.layerHealthEvent.count({ where: { batchId: id } }),
      this.prisma.layerDailyRecord.count({ where: { batchId: id } }),
    ]);
    if (expenseCount > 0 || saleCount > 0 || healthEventCount > 0 || dailyRecordCount > 0) {
      throw new ConflictException(
        "Impossible de supprimer un lot avec des journées de ponte, dépenses, ventes ou événements sanitaires enregistrés — utiliser l'annulation (POST /:id/annuler).",
      );
    }

    await this.prisma.layerBatch.delete({ where: { id } });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'layer_batch',
      entityId: id,
      action: 'LAYER_BATCH_DELETED',
      oldValues: { code: existing.code, status: existing.status },
      ipAddress,
    });
  }

  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<LayerBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const updated = await this.setStatus(
      existing,
      'ANNULEE',
      actingUser,
      'LAYER_BATCH_CANCELLED',
      ipAddress,
    );
    return this.attachComputedFields(updated);
  }

  /**
   * Contrairement à BroilerBatchesService.close (bloqué tant que
   * currentHeadcount > 0), la clôture d'un lot de pondeuses n'est PAS
   * bloquée par l'effectif restant : la vente/réforme des poules elles-mêmes
   * est hors périmètre Phase 4 (aucun moyen de ramener l'effectif à 0 depuis
   * l'application) — bloquer la clôture rendrait l'action inutilisable.
   * La cohérence de l'effectif final est signalée dans le résumé, jamais
   * bloquante (§17).
   */
  async close(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<{ batch: LayerBatchWithComputed; summary: LayerBatchClosureSummary }> {
    const existing = await this.getRaw(actingUser, id);
    const computed = await this.attachComputedFields(existing);
    const summary = await this.computeClosureSummary(existing, computed);
    const updated = await this.setStatus(
      existing,
      'CLOTURE',
      actingUser,
      'LAYER_BATCH_CLOSED',
      ipAddress,
    );
    return { batch: await this.attachComputedFields(updated), summary };
  }

  /**
   * §8.8 — même résumé financier que close(), consultable sur un lot actif.
   */
  async getProfitability(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<LayerBatchClosureSummary> {
    const existing = await this.getRaw(actingUser, id);
    const computed = await this.attachComputedFields(existing);
    return this.computeClosureSummary(existing, computed);
  }

  private async setStatus(
    existing: LayerBatch,
    status: LayerBatchStatus,
    actingUser: AccessTokenPayload,
    action: string,
    ipAddress: string | null,
  ): Promise<LayerBatch> {
    const updated = await this.prisma.layerBatch.update({
      where: { id: existing.id },
      data: { status },
    });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'layer_batch',
      entityId: existing.id,
      action,
      oldValues: { status: existing.status },
      newValues: { status },
      ipAddress,
    });
    return updated;
  }

  private async computeClosureSummary(
    batch: LayerBatch,
    computed: LayerBatchWithComputed,
  ): Promise<LayerBatchClosureSummary> {
    const [dailyRecords, expenses, sales, eggStockLots] = await Promise.all([
      this.prisma.layerDailyRecord.findMany({
        where: { batchId: batch.id },
        orderBy: { date: 'asc' },
      }),
      this.prisma.expense.findMany({ where: { layerBatchId: batch.id, deletedAt: null } }),
      this.prisma.sale.findMany({
        where: { layerBatchId: batch.id, status: NON_CANCELLED_SALE_STATUSES },
      }),
      this.prisma.eggStockLot.findMany({
        where: { batchId: batch.id },
        include: { movements: true },
      }),
    ]);

    const cumulativeEggsLaid = dailyRecords.reduce((sum, r) => sum + r.eggsLaid, 0);
    const cumulativeEggsSellable = dailyRecords.reduce((sum, r) => sum + r.eggsSellable, 0);
    const cumulativeEggsSold = sales.reduce((sum, s) => sum + s.quantity, 0);
    const cumulativeHenDays = dailyRecords.reduce((sum, r) => sum + r.henCount, 0);
    const averageLayingRatePercent =
      dailyRecords.length > 0 ? computeLayingRatePercent(cumulativeEggsLaid, cumulativeHenDays) : 0;

    const remainingEggStock = eggStockLots.reduce(
      (sum, lot) => sum + computeLotRemaining(lot.quantityProduced, lot.movements),
      0,
    );

    const revenueFcfa = computeRevenueFcfa(sales.map((s) => s.netAmountFcfa));
    const totalExpensesFcfa = computeTotalExpensesFcfa(expenses.map((e) => e.amountFcfa));
    const grossMarginFcfa = computeGrossMarginFcfa(revenueFcfa, totalExpensesFcfa);
    const costPerEggFcfa = computeCostPerEggFcfa(totalExpensesFcfa, cumulativeEggsSellable);

    const lastRecordedHenCount =
      dailyRecords.length > 0 ? dailyRecords[dailyRecords.length - 1]!.henCount : null;
    const isCoherent =
      lastRecordedHenCount === null || lastRecordedHenCount === computed.currentHeadcount;

    return {
      production: {
        initialQuantity: batch.initialQuantity,
        currentHeadcount: computed.currentHeadcount,
        cumulativeEggsLaid,
        cumulativeEggsSellable,
        cumulativeEggsSold,
        averageLayingRatePercent,
        daysTracked: dailyRecords.length,
      },
      stock: { remainingEggStock },
      finances: { totalExpensesFcfa, revenueFcfa, grossMarginFcfa, costPerEggFcfa },
      coherence: {
        lastRecordedHenCount,
        computedHeadcount: computed.currentHeadcount,
        isCoherent,
      },
    };
  }
}
