import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type IncubationBatch, type IncubationBatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { BreederBatchesService } from '../breeder-batches/breeder-batches.service';
import {
  computeExpectedCandlingDate,
  computeExpectedHatchDate,
} from './calculations/incubation-dates.calculations';
import { computeCostPerChickHatchedFcfa } from './calculations/incubation-profitability.calculations';
import {
  computeFertilityRatePercent,
  computeHatchRatePercent,
} from './calculations/incubation-kpi.calculations';
import {
  computeGrossMarginFcfa,
  computeProfitabilityRate,
  computeRevenueFcfa,
  computeTotalExpensesFcfa,
} from '../broiler-batches/calculations/broiler-finance.calculations';
import {
  buildIncubationPerformanceScore,
  type BatchPerformanceScore,
} from './calculations/incubation-performance-score.calculations';
import { PerformanceScoreSettingsService } from '../../common/performance-score/performance-score-settings.service';
import {
  coefficientsFromDto,
  type PerformanceScoreCoefficients,
} from '../../common/calculations/performance-score.util';
import type { CreateIncubationBatchDto } from './dto/create-incubation-batch.dto';
import type { UpdateIncubationBatchDto } from './dto/update-incubation-batch.dto';
import type { UpdateIncubationPerformanceCoefficientsDto } from './dto/update-incubation-performance-coefficients.dto';

const CODE_PREFIX_BASE = 'INC';
/** Lot 5 (score de performance) — même convention `<domaine>.<nom>` que
 * les seuils d'alerte existants. */
const PERFORMANCE_COEFFICIENTS_SETTING_KEY = 'incubation.performance_score_coefficients';
const CODE_DIGITS = 3;
/** Phase 8 : couvre à la fois les collisions de code (P2002) et les
 * échecs de sérialisation liés au verrou FOR UPDATE (P2034) — une
 * transaction par tentative, comme StockMovementsService.create(). */
const MAX_TRANSACTION_RETRIES = 3;
const DEFAULT_INCUBATION_DURATION_DAYS = 21;
const DEFAULT_CANDLING_DAY_OFFSET = 7;
const SETTING_KEY_DURATION = 'incubation.duration_days';
const SETTING_KEY_CANDLING_OFFSET = 'incubation.candling_day_offset';
/** §10.5 : mêmes statuts que BroilerBatchesService/ChickBatchesService. */
const CONFIRMED_SALE_STATUSES: Prisma.SaleWhereInput['status'] = {
  in: ['CONFIRMEE', 'PAYEE', 'PARTIELLEMENT_PAYEE', 'IMPAYEE'],
};

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function isUniqueConstraintFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export interface IncubationBatchWithComputed extends IncubationBatch {
  expectedHatchDate: Date;
  expectedCandlingDate: Date;
}

export interface IncubationBatchProfitability {
  totalExpensesFcfa: number;
  revenueFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
  costPerChickHatchedFcfa: number;
  /** Lot 5 (score de performance) — jamais exposés par l'API avant ce lot
   * (dette Phase 13, jusqu'ici recalculés côté client uniquement). `null`
   * tant que `chicksHatched` n'est pas renseigné (post-éclosion
   * uniquement — même restriction que la Comparaison Lot 4, qui limite le
   * couvoir aux lots `ECLOS`), jamais une valeur inventée avant l'éclosion. */
  performance: {
    hatchRatePercent: number | null;
    fertilityRatePercent: number | null;
  };
}

@Injectable()
export class IncubationBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly breederBatchesService: BreederBatchesService,
    private readonly performanceScoreSettings: PerformanceScoreSettingsService,
  ) {}

  private async generateBatchCode(farmId: string, year: number): Promise<string> {
    const prefix = `${CODE_PREFIX_BASE}-${year}-`;
    const last = await this.prisma.incubationBatch.findFirst({
      where: { farmId, code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  private async getSettingNumber(farmId: string, key: string, fallback: number): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { farmId_key: { farmId, key } },
    });
    return typeof setting?.value === 'number' ? setting.value : fallback;
  }

  private async assertIncubatorBelongsToFarm(farmId: string, incubatorId: string): Promise<void> {
    const incubator = await this.prisma.incubator.findUnique({ where: { id: incubatorId } });
    if (!incubator || incubator.farmId !== farmId) {
      throw new NotFoundException('Couveuse introuvable.');
    }
  }

  private async attachComputedFields(
    actingUser: AccessTokenPayload,
    batch: IncubationBatch,
  ): Promise<IncubationBatchWithComputed> {
    const durationDays = await this.getSettingNumber(
      actingUser.farmId,
      SETTING_KEY_DURATION,
      DEFAULT_INCUBATION_DURATION_DAYS,
    );
    const candlingOffset = await this.getSettingNumber(
      actingUser.farmId,
      SETTING_KEY_CANDLING_OFFSET,
      DEFAULT_CANDLING_DAY_OFFSET,
    );
    return {
      ...batch,
      expectedHatchDate: computeExpectedHatchDate(batch.incubationStartDate, durationDays),
      expectedCandlingDate: computeExpectedCandlingDate(batch.incubationStartDate, candlingOffset),
    };
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateIncubationBatchDto,
    ipAddress: string | null,
  ): Promise<IncubationBatchWithComputed> {
    // Filiation obligatoire, non contournable : le lot reproducteur source
    // doit exister et appartenir à la ferme (findOne lève 404 sinon).
    // Pré-vérification rapide hors transaction (message d'erreur immédiat
    // au cas non-concurrent) — la garantie réelle contre le dépassement
    // concurrent reste le verrouillage FOR UPDATE dans createLocked().
    const breederBatch = await this.breederBatchesService.findOne(actingUser, dto.breederBatchId);
    await this.assertIncubatorBelongsToFarm(actingUser.farmId, dto.incubatorId);

    // §15 : aucune quantité supérieure au disponible — égalité acceptée.
    if (dto.eggCount > breederBatch.availableFertileEggs) {
      throw new ConflictException(
        `Nombre d'œufs à incuber (${dto.eggCount}) supérieur aux œufs fécondés disponibles (${breederBatch.availableFertileEggs}).`,
      );
    }

    const incubationStartDate = new Date(dto.incubationStartDate);
    const batch = await this.createLocked(actingUser, dto, incubationStartDate);

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'incubation_batch',
      entityId: batch.id,
      action: 'INCUBATION_BATCH_CREATED',
      newValues: { code: batch.code, breederBatchId: dto.breederBatchId, eggCount: dto.eggCount },
      ipAddress,
    });

    return this.attachComputedFields(actingUser, batch);
  }

  /**
   * Phase 8 — durcissement concurrence (dette transversale "disponibilité
   * sans verrou" corrigée). Une transaction PAR tentative (comme
   * StockMovementsService.create()) : verrou+validation
   * (BreederBatchesService.assertAvailableFertileEggsInTransaction) EN
   * PREMIER dans la transaction, puis génération de code + création —
   * fusionne l'ancienne boucle retry (P2002, collision de code) avec le
   * retry P2034 (échec de sérialisation dû au verrou).
   */
  private async createLocked(
    actingUser: AccessTokenPayload,
    dto: CreateIncubationBatchDto,
    incubationStartDate: Date,
  ): Promise<IncubationBatch> {
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.breederBatchesService.assertAvailableFertileEggsInTransaction(
            tx,
            actingUser.farmId,
            dto.breederBatchId,
            dto.eggCount,
          );
          const code = await this.generateBatchCode(
            actingUser.farmId,
            incubationStartDate.getFullYear(),
          );
          return tx.incubationBatch.create({
            data: {
              farmId: actingUser.farmId,
              code,
              breederBatchId: dto.breederBatchId,
              incubatorId: dto.incubatorId,
              incubationStartDate,
              eggCount: dto.eggCount,
              remarks: dto.remarks,
              createdBy: actingUser.sub,
            },
          });
        });
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }
        if (
          (isSerializationFailure(error) || isUniqueConstraintFailure(error)) &&
          attempt < MAX_TRANSACTION_RETRIES - 1
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Impossible de générer un code de lot unique — réessayer.');
  }

  async findAll(actingUser: AccessTokenPayload): Promise<IncubationBatchWithComputed[]> {
    const batches = await this.prisma.incubationBatch.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(batches.map((batch) => this.attachComputedFields(actingUser, batch)));
  }

  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<IncubationBatch> {
    const batch = await this.prisma.incubationBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException("Lot d'incubation introuvable.");
    }
    assertSameFarm(actingUser, batch.farmId);
    return batch;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<IncubationBatchWithComputed> {
    const batch = await this.getRaw(actingUser, id);
    return this.attachComputedFields(actingUser, batch);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateIncubationBatchDto,
    ipAddress: string | null,
  ): Promise<IncubationBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    if (dto.incubatorId) {
      await this.assertIncubatorBelongsToFarm(actingUser.farmId, dto.incubatorId);
    }

    const updated = await this.prisma.incubationBatch.update({
      where: { id },
      data: {
        ...dto,
        incubationStartDate: dto.incubationStartDate
          ? new Date(dto.incubationStartDate)
          : undefined,
        actualHatchDate: dto.actualHatchDate ? new Date(dto.actualHatchDate) : undefined,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'incubation_batch',
      entityId: id,
      action: 'INCUBATION_BATCH_UPDATED',
      oldValues: { status: existing.status, chicksHatched: existing.chicksHatched },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputedFields(actingUser, updated);
  }

  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<IncubationBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const updated = await this.setStatus(
      existing,
      'ANNULEE',
      actingUser,
      'INCUBATION_BATCH_CANCELLED',
      ipAddress,
    );
    return this.attachComputedFields(actingUser, updated);
  }

  async close(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<IncubationBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const updated = await this.setStatus(
      existing,
      'CLOTURE',
      actingUser,
      'INCUBATION_BATCH_CLOSED',
      ipAddress,
    );
    return this.attachComputedFields(actingUser, updated);
  }

  /**
   * §8.8 — CA = ventes confirmées des lots de poussins issus de ce lot
   * d'incubation (filiation VENTE uniquement, via BatchLineage ; les
   * orientations CHAIR/RENOUVELLEMENT n'engendrent pas de vente directement
   * rattachable au couvoir — leur valorisation appartient au P&L de la
   * bande poulet de chair/pondeuse qui les reçoit, pas à celui-ci, pour
   * éviter un double comptage). Charges = Expense.incubationBatchId
   * (rattachement direct, Phase 7).
   */
  async getProfitability(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<IncubationBatchProfitability> {
    const batch = await this.getRaw(actingUser, id);

    const [expenses, lineages] = await Promise.all([
      this.prisma.expense.findMany({
        where: { incubationBatchId: batch.id, deletedAt: null },
      }),
      this.prisma.batchLineage.findMany({
        where: { incubationBatchId: batch.id, childType: 'chick_batch' },
      }),
    ]);

    const chickBatchIds = lineages
      .map((lineage) => lineage.childId)
      .filter((childId): childId is string => childId !== null);

    const sales = chickBatchIds.length
      ? await this.prisma.sale.findMany({
          where: { chickBatchId: { in: chickBatchIds }, status: CONFIRMED_SALE_STATUSES },
        })
      : [];

    const totalExpensesFcfa = computeTotalExpensesFcfa(
      expenses.map((expense) => expense.amountFcfa),
    );
    const revenueFcfa = computeRevenueFcfa(sales.map((sale) => sale.netAmountFcfa));
    const grossMarginFcfa = computeGrossMarginFcfa(revenueFcfa, totalExpensesFcfa);

    const hasHatchData = batch.chicksHatched !== null;
    const fertileEggs = hasHatchData ? batch.eggCount - (batch.eggsInfertile ?? 0) : null;

    return {
      totalExpensesFcfa,
      revenueFcfa,
      grossMarginFcfa,
      profitabilityRate: computeProfitabilityRate(grossMarginFcfa, totalExpensesFcfa),
      costPerChickHatchedFcfa: computeCostPerChickHatchedFcfa(
        totalExpensesFcfa,
        batch.chicksHatched ?? 0,
      ),
      performance: {
        hatchRatePercent: hasHatchData
          ? computeHatchRatePercent(batch.chicksHatched!, batch.eggCount)
          : null,
        fertilityRatePercent:
          hasHatchData && fertileEggs !== null
            ? computeFertilityRatePercent(fertileEggs, batch.eggCount)
            : null,
      },
    };
  }

  /** Score de performance (Lot 5) — réutilise `getProfitability` pour ses
   * composantes brutes (hatch/fertility rate), déjà `null` avant
   * l'éclosion. */
  async getPerformanceScore(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<BatchPerformanceScore> {
    const [profitability, coefficients] = await Promise.all([
      this.getProfitability(actingUser, id),
      this.performanceScoreSettings.getCoefficients(
        actingUser.farmId,
        PERFORMANCE_COEFFICIENTS_SETTING_KEY,
      ),
    ]);
    return buildIncubationPerformanceScore(
      {
        hatchRatePercent: profitability.performance.hatchRatePercent,
        fertilityRatePercent: profitability.performance.fertilityRatePercent,
      },
      coefficients,
    );
  }

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
    dto: UpdateIncubationPerformanceCoefficientsDto,
  ): Promise<PerformanceScoreCoefficients> {
    return this.performanceScoreSettings.setCoefficients(
      actingUser.farmId,
      PERFORMANCE_COEFFICIENTS_SETTING_KEY,
      coefficientsFromDto(dto),
    );
  }

  private async setStatus(
    existing: IncubationBatch,
    status: IncubationBatchStatus,
    actingUser: AccessTokenPayload,
    action: string,
    ipAddress: string | null,
  ): Promise<IncubationBatch> {
    const updated = await this.prisma.incubationBatch.update({
      where: { id: existing.id },
      data: { status },
    });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'incubation_batch',
      entityId: existing.id,
      action,
      oldValues: { status: existing.status },
      newValues: { status },
      ipAddress,
    });
    return updated;
  }
}
