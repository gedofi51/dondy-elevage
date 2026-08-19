import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BroilerBatch, BroilerBatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  computeCumulativeMortalityRate,
  computeRemainingHeadcount,
  computeStartedQuantity,
} from './calculations/broiler-headcount.calculations';
import { computeCumulativeFeedConsumption } from './calculations/broiler-feed.calculations';
import { computeFeedConversionRatio } from './calculations/broiler-growth.calculations';
import {
  computeCostPerChickProducedFcfa,
  computeCostPerChickSoldFcfa,
  computeGrossMarginFcfa,
  computeProfitabilityRate,
  computeRevenueFcfa,
  computeTotalExpensesFcfa,
} from './calculations/broiler-finance.calculations';
import type { CreateBroilerBatchDto } from './dto/create-broiler-batch.dto';
import type { UpdateBroilerBatchDto } from './dto/update-broiler-batch.dto';

const DAILY_CYCLE_LENGTH = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** §10.5 : seules les ventes confirmées ou postérieures réduisent l'effectif disponible. */
const CONFIRMED_SALE_STATUSES: Prisma.SaleWhereInput['status'] = {
  in: ['CONFIRMEE', 'PAYEE', 'PARTIELLEMENT_PAYEE', 'IMPAYEE'],
};

export interface BroilerBatchWithComputed extends BroilerBatch {
  startedQuantity: number;
  chickCostFcfa: number;
  totalAcquisitionCostFcfa: number;
  currentHeadcount: number;
}

export interface BatchClosureSummary {
  production: {
    receivedQuantity: number;
    startedQuantity: number;
    cumulativeMortality: number;
    soldCount: number;
    cycleDurationDays: number;
  };
  performance: {
    cumulativeMortalityRate: number;
    finalAverageWeightG: number | null;
    totalFeedConsumptionKg: number;
    /** Approximation : gain de poids vif = poids moyen final × effectif démarré
     * (poids d'arrivée des poussins, de l'ordre de quelques dizaines de
     * grammes, négligé — erreur induite marginale sur un poulet de ~1,5-2 kg
     * à J45). */
    feedConversionRatio: number;
  };
  finances: {
    totalExpensesFcfa: number;
    revenueFcfa: number;
    grossMarginFcfa: number;
    profitabilityRate: number;
    costPerChickProducedFcfa: number;
    costPerChickSoldFcfa: number;
  };
  coherence: {
    dailyRecordMortalityTotal: number;
    detailedMortalityTotal: number;
    /** §17 : "toute divergence doit produire une alerte de cohérence" — voir
     * BroilerAlertsCronService, qui matérialise cette divergence en alerte
     * CRITIQUE dès qu'elle apparaît, pas seulement au moment de la clôture. */
    isCoherent: boolean;
  };
}

@Injectable()
export class BroilerBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private computeAcquisitionFigures(
    batch: Pick<
      BroilerBatch,
      | 'receivedQuantity'
      | 'deadOnArrivalQuantity'
      | 'unitPriceFcfa'
      | 'transportCostFcfa'
      | 'otherCostsFcfa'
    >,
  ): { startedQuantity: number; chickCostFcfa: number; totalAcquisitionCostFcfa: number } {
    const startedQuantity = computeStartedQuantity(
      batch.receivedQuantity,
      batch.deadOnArrivalQuantity,
    );
    // §4.3 : "Coût poussins = nombre reçu × prix unitaire" — sur receivedQuantity,
    // pas startedQuantity (les poussins morts à l'arrivée ont quand même été achetés).
    const chickCostFcfa = batch.receivedQuantity * batch.unitPriceFcfa;
    const totalAcquisitionCostFcfa = chickCostFcfa + batch.transportCostFcfa + batch.otherCostsFcfa;
    return { startedQuantity, chickCostFcfa, totalAcquisitionCostFcfa };
  }

  private async computeCurrentHeadcount(batchId: string, startedQuantity: number): Promise<number> {
    const [dailyAgg, soldAgg] = await Promise.all([
      this.prisma.broilerDailyRecord.aggregate({
        where: { batchId },
        _sum: { mortalityQuantity: true, cullsQuantity: true, otherExitsQuantity: true },
      }),
      this.prisma.sale.aggregate({
        where: { batchId, status: CONFIRMED_SALE_STATUSES },
        _sum: { quantity: true },
      }),
    ]);
    return computeRemainingHeadcount({
      startedQuantity,
      cumulativeMortality: dailyAgg._sum.mortalityQuantity ?? 0,
      cumulativeCulls: dailyAgg._sum.cullsQuantity ?? 0,
      cumulativeOtherExits: dailyAgg._sum.otherExitsQuantity ?? 0,
      cumulativeConfirmedSold: soldAgg._sum.quantity ?? 0,
    });
  }

  private async attachComputedFields(batch: BroilerBatch): Promise<BroilerBatchWithComputed> {
    const figures = this.computeAcquisitionFigures(batch);
    const currentHeadcount = await this.computeCurrentHeadcount(batch.id, figures.startedQuantity);
    return { ...batch, ...figures, currentHeadcount };
  }

  /** Dérivé du dernier code émis pour la ferme+année (PC-AAAA-NNN) — même
   * principe que CustomersService.generateCode, avec le scope annuel en plus. */
  private async generateBatchCode(farmId: string, year: number): Promise<string> {
    const prefix = `PC-${year}-`;
    const last = await this.prisma.broilerBatch.findFirst({
      where: { farmId, code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
  }

  private async assertReferencesBelongToFarm(
    farmId: string,
    refs: { buildingId?: string; primaryManagerId?: string; supplierId?: string },
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
    if (refs.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: refs.supplierId } });
      if (!supplier || supplier.farmId !== farmId) {
        throw new NotFoundException('Fournisseur introuvable.');
      }
    }
  }

  /**
   * `tx` optionnel : permet à un appelant (OrientationService, Phase 5) de
   * faire participer la création de cette bande + ses 45 journées à une
   * transaction englobante (bande + BatchLineage atomiques). Quand `tx` est
   * fourni, aucune transaction n'est ouverte ici (on réutilise celle de
   * l'appelant — Prisma ne supporte pas les transactions interactives
   * imbriquées) et le log d'audit n'est PAS écrit ici : il serait visible
   * avant même le commit de la transaction englobante, et resterait orphelin
   * si celle-ci échouait ensuite (ex. échec de l'INSERT BatchLineage) — c'est
   * à l'appelant de journaliser après le commit de sa propre transaction.
   */
  async create(
    actingUser: AccessTokenPayload,
    dto: CreateBroilerBatchDto,
    ipAddress: string | null,
  ): Promise<BroilerBatchWithComputed>;
  async create(
    actingUser: AccessTokenPayload,
    dto: CreateBroilerBatchDto,
    ipAddress: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<BroilerBatch>;
  async create(
    actingUser: AccessTokenPayload,
    dto: CreateBroilerBatchDto,
    ipAddress: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<BroilerBatchWithComputed | BroilerBatch> {
    if (dto.origin === 'ACHAT' && !dto.supplierId) {
      throw new BadRequestException("Le fournisseur est requis lorsque l'origine est 'achat'.");
    }

    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      buildingId: dto.buildingId,
      primaryManagerId: dto.primaryManagerId,
      supplierId: dto.supplierId,
    });

    const arrivalDate = new Date(dto.arrivalDate);
    const code = await this.generateBatchCode(actingUser.farmId, arrivalDate.getFullYear());
    // §4.3 : "La date cible J45 est calculée par Date d'arrivée + 44 jours."
    const plannedSaleDate = dto.plannedSaleDate
      ? new Date(dto.plannedSaleDate)
      : new Date(arrivalDate.getTime() + 44 * MS_PER_DAY);

    const writeBatch = async (client: Prisma.TransactionClient): Promise<BroilerBatch> => {
      const created = await client.broilerBatch.create({
        data: {
          farmId: actingUser.farmId,
          code,
          breed: dto.breed,
          arrivalDate,
          arrivalTime: dto.arrivalTime,
          origin: dto.origin,
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber,
          orderedQuantity: dto.orderedQuantity,
          receivedQuantity: dto.receivedQuantity,
          deadOnArrivalQuantity: dto.deadOnArrivalQuantity ?? 0,
          unitPriceFcfa: dto.unitPriceFcfa,
          transportCostFcfa: dto.transportCostFcfa ?? 0,
          otherCostsFcfa: dto.otherCostsFcfa ?? 0,
          buildingId: dto.buildingId,
          primaryManagerId: dto.primaryManagerId,
          plannedSaleDate,
          observations: dto.observations,
          createdBy: actingUser.sub,
        },
      });

      // §5 : "le système génère automatiquement 45 journées de suivi" —
      // atomique avec la création de la bande (une des 45 lignes manquante
      // après un échec partiel casserait cette garantie).
      const dailyRecordsData = Array.from({ length: DAILY_CYCLE_LENGTH }, (_, index) => ({
        farmId: actingUser.farmId,
        batchId: created.id,
        dayNumber: index + 1,
        date: new Date(arrivalDate.getTime() + index * MS_PER_DAY),
      }));
      await client.broilerDailyRecord.createMany({ data: dailyRecordsData });

      return created;
    };

    const batch = tx ? await writeBatch(tx) : await this.prisma.$transaction(writeBatch);

    if (tx) {
      return batch;
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_batch',
      entityId: batch.id,
      action: 'BROILER_BATCH_CREATED',
      newValues: {
        code: batch.code,
        receivedQuantity: batch.receivedQuantity,
        buildingId: batch.buildingId,
      },
      ipAddress,
    });

    return this.attachComputedFields(batch);
  }

  async findAll(actingUser: AccessTokenPayload): Promise<BroilerBatchWithComputed[]> {
    const batches = await this.prisma.broilerBatch.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(batches.map((batch) => this.attachComputedFields(batch)));
  }

  /** Usage interne (update/remove/annuler/clôturer) : pas de champs calculés. */
  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<BroilerBatch> {
    const batch = await this.prisma.broilerBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Bande introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
    return batch;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<BroilerBatchWithComputed> {
    const batch = await this.getRaw(actingUser, id);
    return this.attachComputedFields(batch);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateBroilerBatchDto,
    ipAddress: string | null,
  ): Promise<BroilerBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      buildingId: dto.buildingId,
      primaryManagerId: dto.primaryManagerId,
      supplierId: dto.supplierId,
    });

    const updated = await this.prisma.broilerBatch.update({
      where: { id },
      data: {
        ...dto,
        arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : undefined,
        plannedSaleDate: dto.plannedSaleDate ? new Date(dto.plannedSaleDate) : undefined,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_batch',
      entityId: id,
      action: 'BROILER_BATCH_UPDATED',
      oldValues: { status: existing.status, receivedQuantity: existing.receivedQuantity },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputedFields(updated);
  }

  /**
   * Suppression définitive — uniquement si la bande n'a strictement aucune
   * activité financière ou sanitaire enregistrée (Expense/Sale/Mortality
   * détaillée/événement sanitaire), quel que soit le rôle (Propriétaire
   * inclus, pas de contournement par permission sur une règle d'intégrité).
   * Dans tous les autres cas : POST /:id/annuler (status -> ANNULEE).
   * Les 45 BroilerDailyRecord (placeholders auto-générés, jamais qualifiés
   * de données sanitaires dans ce schéma) sont supprimés avec la bande.
   */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.getRaw(actingUser, id);

    const [expenseCount, saleCount, mortalityCount, healthEventCount] = await Promise.all([
      this.prisma.expense.count({ where: { batchId: id, deletedAt: null } }),
      this.prisma.sale.count({ where: { batchId: id } }),
      this.prisma.broilerMortality.count({ where: { batchId: id, deletedAt: null } }),
      this.prisma.broilerHealthEvent.count({ where: { batchId: id } }),
    ]);
    if (expenseCount > 0 || saleCount > 0 || mortalityCount > 0 || healthEventCount > 0) {
      throw new ConflictException(
        "Impossible de supprimer une bande avec des dépenses, ventes, mortalités détaillées ou événements sanitaires enregistrés — utiliser l'annulation (POST /:id/annuler).",
      );
    }

    await this.prisma.$transaction([
      this.prisma.broilerDailyRecord.deleteMany({ where: { batchId: id } }),
      this.prisma.broilerBatch.delete({ where: { id } }),
    ]);

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_batch',
      entityId: id,
      action: 'BROILER_BATCH_DELETED',
      oldValues: { code: existing.code, status: existing.status },
      ipAddress,
    });
  }

  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<BroilerBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const updated = await this.setStatus(
      existing,
      'ANNULEE',
      actingUser,
      'BROILER_BATCH_CANCELLED',
      ipAddress,
    );
    return this.attachComputedFields(updated);
  }

  /**
   * §11 : clôture bloquée tant que des animaux restent vivants/disponibles
   * ("lorsque tous les animaux sont vendus ou sortis"). Retourne le résumé
   * de cohérence (production/performance/finances) affiché avant clôture.
   */
  async close(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<{ batch: BroilerBatchWithComputed; summary: BatchClosureSummary }> {
    const existing = await this.getRaw(actingUser, id);
    const computed = await this.attachComputedFields(existing);

    if (computed.currentHeadcount > 0) {
      throw new ConflictException(
        `Impossible de clôturer : ${computed.currentHeadcount} sujet(s) encore vivant(s)/disponible(s) — vendre ou sortir tous les animaux avant clôture.`,
      );
    }

    const summary = await this.computeClosureSummary(existing, computed);
    const updated = await this.setStatus(
      existing,
      'CLOTUREE',
      actingUser,
      'BROILER_BATCH_CLOSED',
      ipAddress,
    );

    return { batch: await this.attachComputedFields(updated), summary };
  }

  private async setStatus(
    existing: BroilerBatch,
    status: BroilerBatchStatus,
    actingUser: AccessTokenPayload,
    action: string,
    ipAddress: string | null,
  ): Promise<BroilerBatch> {
    const updated = await this.prisma.broilerBatch.update({
      where: { id: existing.id },
      data: { status },
    });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_batch',
      entityId: existing.id,
      action,
      oldValues: { status: existing.status },
      newValues: { status },
      ipAddress,
    });
    return updated;
  }

  private async computeClosureSummary(
    batch: BroilerBatch,
    computed: BroilerBatchWithComputed,
  ): Promise<BatchClosureSummary> {
    const [dailyRecords, mortalities, expenses, sales] = await Promise.all([
      this.prisma.broilerDailyRecord.findMany({
        where: { batchId: batch.id },
        orderBy: { dayNumber: 'asc' },
      }),
      this.prisma.broilerMortality.findMany({ where: { batchId: batch.id, deletedAt: null } }),
      this.prisma.expense.findMany({ where: { batchId: batch.id, deletedAt: null } }),
      this.prisma.sale.findMany({ where: { batchId: batch.id, status: CONFIRMED_SALE_STATUSES } }),
    ]);

    const dailyRecordMortalityTotal = dailyRecords.reduce((sum, r) => sum + r.mortalityQuantity, 0);
    const detailedMortalityTotal = mortalities.reduce((sum, m) => sum + m.quantity, 0);
    // Cohérente si aucune mortalité détaillée n'a été saisie (rien à
    // comparer) ou si les deux totaux concordent exactement — §17.
    const isCoherent =
      detailedMortalityTotal === 0 || dailyRecordMortalityTotal === detailedMortalityTotal;

    const weighedRecords = dailyRecords.filter((r) => r.averageWeightG !== null);
    const finalAverageWeightG =
      weighedRecords.length > 0 ? weighedRecords[weighedRecords.length - 1]!.averageWeightG : null;

    const totalFeedConsumptionKg = computeCumulativeFeedConsumption(
      dailyRecords.map((r) => Number(r.feedDistributedKg ?? 0)),
    );

    const soldCount = sales.reduce((sum, s) => sum + s.quantity, 0);
    const revenueFcfa = computeRevenueFcfa(sales.map((s) => s.netAmountFcfa));
    const totalExpensesFcfa =
      computeTotalExpensesFcfa(expenses.map((e) => e.amountFcfa)) +
      computed.totalAcquisitionCostFcfa;
    const grossMarginFcfa = computeGrossMarginFcfa(revenueFcfa, totalExpensesFcfa);

    const liveWeightGainKg =
      finalAverageWeightG !== null ? (finalAverageWeightG * computed.startedQuantity) / 1000 : 0;

    const cycleDurationDays = Math.round((Date.now() - batch.arrivalDate.getTime()) / MS_PER_DAY);

    return {
      production: {
        receivedQuantity: batch.receivedQuantity,
        startedQuantity: computed.startedQuantity,
        cumulativeMortality: dailyRecordMortalityTotal,
        soldCount,
        cycleDurationDays,
      },
      performance: {
        cumulativeMortalityRate: computeCumulativeMortalityRate(
          dailyRecordMortalityTotal,
          computed.startedQuantity,
        ),
        finalAverageWeightG,
        totalFeedConsumptionKg,
        feedConversionRatio: computeFeedConversionRatio(totalFeedConsumptionKg, liveWeightGainKg),
      },
      finances: {
        totalExpensesFcfa,
        revenueFcfa,
        grossMarginFcfa,
        profitabilityRate: computeProfitabilityRate(grossMarginFcfa, totalExpensesFcfa),
        costPerChickProducedFcfa: computeCostPerChickProducedFcfa(
          totalExpensesFcfa,
          computed.startedQuantity,
        ),
        costPerChickSoldFcfa: computeCostPerChickSoldFcfa(totalExpensesFcfa, soldCount),
      },
      coherence: { dailyRecordMortalityTotal, detailedMortalityTotal, isCoherent },
    };
  }
}
