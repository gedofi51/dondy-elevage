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
import {
  buildBroilerForecast,
  type BroilerForecast,
} from './calculations/broiler-forecast.calculations';
import {
  buildBroilerPerformanceScore,
  type BatchPerformanceScore,
} from './calculations/broiler-performance-score.calculations';
import { PerformanceScoreSettingsService } from '../../common/performance-score/performance-score-settings.service';
import {
  coefficientsFromDto,
  type PerformanceScoreCoefficients,
} from '../../common/calculations/performance-score.util';
import type { CreateBroilerBatchDto } from './dto/create-broiler-batch.dto';
import type { UpdateBroilerBatchDto } from './dto/update-broiler-batch.dto';
import type { UpdateBroilerPerformanceCoefficientsDto } from './dto/update-broiler-performance-coefficients.dto';

/** Prévisions production (Lot 3) — statuts pour lesquels une projection a
 * un sens : BROUILLON/PLANIFIEE (cycle pas encore démarré, pas de
 * tendance à extrapoler) et VENDUE/CLOTUREE/ANNULEE (cycle terminé, plus
 * de trajectoire future) sont exclus de GET /broiler-batches/previsions —
 * décision Lot 3, voir DETTE_TECHNIQUE.md. */
const PROJECTABLE_BROILER_STATUSES: BroilerBatchStatus[] = [
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
];

/** Lot 5 (score de performance) — clé `Setting`, même convention
 * `<domaine>.<nom>` que les seuils d'alerte existants (voir
 * broiler-alerts.cron.ts, MORTALITY_THRESHOLD_SETTING_KEY). */
const PERFORMANCE_COEFFICIENTS_SETTING_KEY = 'broiler.performance_score_coefficients';

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
    private readonly performanceScoreSettings: PerformanceScoreSettingsService,
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

  /** `tx` optionnel (Phase 8) : permet de recalculer l'agrégat DANS la
   * transaction verrouillée de assertAvailableHeadcountInTransaction, sans
   * dupliquer la formule. Hors transaction (findAll/findOne), aucun verrou
   * n'est jamais pris ici — voir assertAvailableHeadcountInTransaction pour
   * le seul endroit où FOR UPDATE est utilisé. */
  private async computeCurrentHeadcount(
    batchId: string,
    startedQuantity: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const [dailyAgg, soldAgg] = await Promise.all([
      client.broilerDailyRecord.aggregate({
        where: { batchId },
        _sum: { mortalityQuantity: true, cullsQuantity: true, otherExitsQuantity: true },
      }),
      client.sale.aggregate({
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

  /**
   * Phase 8 — durcissement concurrence (dette transversale "disponibilité
   * sans verrou" corrigée). Verrouille la ligne BroilerBatch
   * (SELECT ... FOR UPDATE, seul endroit du service où un verrou est pris
   * — jamais dans computeCurrentHeadcount lui-même, pour ne pas verrouiller
   * inutilement un simple GET) avant de recalculer l'effectif via CE MÊME
   * client transactionnel, puis compare. `tx` obligatoire (jamais
   * optionnel) : l'appelant (SalesService) doit fournir une transaction
   * déjà ouverte, comme StockMovementsService.recordMovementInTransaction.
   */
  async assertAvailableHeadcountInTransaction(
    tx: Prisma.TransactionClient,
    farmId: string,
    batchId: string,
    requestedQuantity: number,
  ): Promise<void> {
    const [locked] = await tx.$queryRaw<
      { id: string; receivedQuantity: number; deadOnArrivalQuantity: number }[]
    >`
      SELECT id, receivedQuantity, deadOnArrivalQuantity FROM broiler_batches
      WHERE id = ${batchId} AND farmId = ${farmId}
      FOR UPDATE
    `;
    if (!locked) {
      throw new NotFoundException('Bande introuvable.');
    }
    const startedQuantity = computeStartedQuantity(
      locked.receivedQuantity,
      locked.deadOnArrivalQuantity,
    );
    const currentHeadcount = await this.computeCurrentHeadcount(batchId, startedQuantity, tx);
    if (requestedQuantity > currentHeadcount) {
      throw new ConflictException(
        `Quantité vendue (${requestedQuantity}) supérieure à l'effectif disponible (${currentHeadcount}).`,
      );
    }
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

  /** Option A (Bâtiments/Blocs) — vérifie que le bloc appartient à la
   * ferme ET au bâtiment effectif (celui du DTO en création, ou celui déjà
   * enregistré si non modifié en édition — voir les deux appelants).
   * `blockId` falsy (undefined/null/'') = pas de vérification, valeur
   * ignorée ou effacée. */
  private async assertBlockBelongsToBuilding(
    farmId: string,
    blockId: string | null | undefined,
    effectiveBuildingId: string,
  ): Promise<void> {
    if (!blockId) {
      return;
    }
    const block = await this.prisma.block.findUnique({ where: { id: blockId } });
    if (!block || block.farmId !== farmId) {
      throw new NotFoundException('Bloc introuvable.');
    }
    if (block.buildingId !== effectiveBuildingId) {
      throw new BadRequestException("Le bloc sélectionné n'appartient pas au bâtiment choisi.");
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
    await this.assertBlockBelongsToBuilding(actingUser.farmId, dto.blockId, dto.buildingId);

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
          blockId: dto.blockId,
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

  /**
   * Prévisions production (Lot 3) — GET /broiler-batches/previsions. Une
   * requête par bande (pas de requête groupée type Lot 2/items) : même
   * précédent que findAll()/attachComputedFields() dans ce service, qui
   * fait déjà un aller BDD par bande pour computeCurrentHeadcount — un
   * nombre de bandes actives reste de l'ordre de la dizaine par ferme,
   * contrairement aux mouvements de stock. Délégation à
   * buildBroilerForecast() (pure, testée séparément) pour l'arithmétique.
   */
  async findAllForecast(actingUser: AccessTokenPayload): Promise<BroilerForecast[]> {
    const batches = await this.prisma.broilerBatch.findMany({
      where: { farmId: actingUser.farmId, status: { in: PROJECTABLE_BROILER_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();

    return Promise.all(
      batches.map(async (batch) => {
        const figures = this.computeAcquisitionFigures(batch);
        const [currentHeadcount, dailyAgg, weighings] = await Promise.all([
          this.computeCurrentHeadcount(batch.id, figures.startedQuantity),
          this.prisma.broilerDailyRecord.aggregate({
            where: { batchId: batch.id },
            _sum: { mortalityQuantity: true },
          }),
          this.prisma.broilerDailyRecord.findMany({
            where: { batchId: batch.id, averageWeightG: { not: null } },
            orderBy: { dayNumber: 'desc' },
            take: 2,
            select: { dayNumber: true, averageWeightG: true },
          }),
        ]);

        return buildBroilerForecast(
          {
            batchId: batch.id,
            arrivalDate: batch.arrivalDate,
            plannedSaleDate: batch.plannedSaleDate,
            startedQuantity: figures.startedQuantity,
            currentHeadcount,
            cumulativeMortality: dailyAgg._sum.mortalityQuantity ?? 0,
            latestWeighing: weighings[0]
              ? { dayNumber: weighings[0].dayNumber, averageWeightG: weighings[0].averageWeightG! }
              : null,
            previousWeighing: weighings[1]
              ? { dayNumber: weighings[1].dayNumber, averageWeightG: weighings[1].averageWeightG! }
              : null,
          },
          now,
        );
      }),
    );
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
    await this.assertBlockBelongsToBuilding(
      actingUser.farmId,
      dto.blockId,
      dto.buildingId ?? existing.buildingId,
    );

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

  /**
   * §8.8 — même résumé financier que close(), mais consultable sur une
   * bande active (aucune vérification d'effectif nul) : la rentabilité
   * est une lecture, pas une action de clôture.
   */
  async getProfitability(actingUser: AccessTokenPayload, id: string): Promise<BatchClosureSummary> {
    const existing = await this.getRaw(actingUser, id);
    const computed = await this.attachComputedFields(existing);
    return this.computeClosureSummary(existing, computed);
  }

  /**
   * Score de performance (Lot 5) — réutilise `computeClosureSummary`
   * (même source que `/profitability`) pour ses composantes brutes, pas de
   * requêtes dupliquées. Consultable sur une bande active, même principe
   * que `getProfitability`.
   */
  async getPerformanceScore(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<BatchPerformanceScore> {
    const [summary, coefficients] = await Promise.all([
      this.getProfitability(actingUser, id),
      this.performanceScoreSettings.getCoefficients(
        actingUser.farmId,
        PERFORMANCE_COEFFICIENTS_SETTING_KEY,
      ),
    ]);
    return buildBroilerPerformanceScore(
      {
        cumulativeMortalityRate: summary.performance.cumulativeMortalityRate,
        finalAverageWeightG: summary.performance.finalAverageWeightG,
        totalFeedConsumptionKg: summary.performance.totalFeedConsumptionKg,
        startedQuantity: summary.production.startedQuantity,
        cycleDurationDays: summary.production.cycleDurationDays,
      },
      coefficients,
    );
  }

  /** Lecture des coefficients configurés (`Setting`, objet vide si jamais
   * configuré — le score applique alors les poids par défaut, voir
   * buildBroilerPerformanceScore). Même permission que la lecture du score
   * lui-même (BROILER_BATCHES_READ) — seule l'écriture est restreinte
   * (FARMS_UPDATE, voir le contrôleur). */
  async getPerformanceCoefficients(
    actingUser: AccessTokenPayload,
  ): Promise<PerformanceScoreCoefficients> {
    return this.performanceScoreSettings.getCoefficients(
      actingUser.farmId,
      PERFORMANCE_COEFFICIENTS_SETTING_KEY,
    );
  }

  async updatePerformanceCoefficients(
    actingUser: AccessTokenPayload,
    dto: UpdateBroilerPerformanceCoefficientsDto,
  ): Promise<PerformanceScoreCoefficients> {
    return this.performanceScoreSettings.setCoefficients(
      actingUser.farmId,
      PERFORMANCE_COEFFICIENTS_SETTING_KEY,
      coefficientsFromDto(dto),
    );
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
