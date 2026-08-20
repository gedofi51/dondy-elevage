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
  computeGrossMarginFcfa,
  computeProfitabilityRate,
  computeRevenueFcfa,
  computeTotalExpensesFcfa,
} from '../broiler-batches/calculations/broiler-finance.calculations';
import type { CreateIncubationBatchDto } from './dto/create-incubation-batch.dto';
import type { UpdateIncubationBatchDto } from './dto/update-incubation-batch.dto';

const CODE_PREFIX_BASE = 'INC';
const CODE_DIGITS = 3;
const MAX_CODE_RETRIES = 3;
const DEFAULT_INCUBATION_DURATION_DAYS = 21;
const DEFAULT_CANDLING_DAY_OFFSET = 7;
const SETTING_KEY_DURATION = 'incubation.duration_days';
const SETTING_KEY_CANDLING_OFFSET = 'incubation.candling_day_offset';
/** §10.5 : mêmes statuts que BroilerBatchesService/ChickBatchesService. */
const CONFIRMED_SALE_STATUSES: Prisma.SaleWhereInput['status'] = {
  in: ['CONFIRMEE', 'PAYEE', 'PARTIELLEMENT_PAYEE', 'IMPAYEE'],
};

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
}

@Injectable()
export class IncubationBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly breederBatchesService: BreederBatchesService,
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
    const breederBatch = await this.breederBatchesService.findOne(actingUser, dto.breederBatchId);
    await this.assertIncubatorBelongsToFarm(actingUser.farmId, dto.incubatorId);

    // §15 : aucune quantité supérieure au disponible — égalité acceptée.
    if (dto.eggCount > breederBatch.availableFertileEggs) {
      throw new ConflictException(
        `Nombre d'œufs à incuber (${dto.eggCount}) supérieur aux œufs fécondés disponibles (${breederBatch.availableFertileEggs}).`,
      );
    }

    const incubationStartDate = new Date(dto.incubationStartDate);

    let batch: IncubationBatch | undefined;
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateBatchCode(
        actingUser.farmId,
        incubationStartDate.getFullYear(),
      );
      try {
        batch = await this.prisma.incubationBatch.create({
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
      entityType: 'incubation_batch',
      entityId: batch.id,
      action: 'INCUBATION_BATCH_CREATED',
      newValues: { code: batch.code, breederBatchId: dto.breederBatchId, eggCount: dto.eggCount },
      ipAddress,
    });

    return this.attachComputedFields(actingUser, batch);
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

    return {
      totalExpensesFcfa,
      revenueFcfa,
      grossMarginFcfa,
      profitabilityRate: computeProfitabilityRate(grossMarginFcfa, totalExpensesFcfa),
      costPerChickHatchedFcfa: computeCostPerChickHatchedFcfa(
        totalExpensesFcfa,
        batch.chicksHatched ?? 0,
      ),
    };
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
