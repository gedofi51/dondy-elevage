import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ChickBatch, type ChickBatchPurpose } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { computeChickCurrentHeadcount } from './calculations/chick-headcount.calculations';
import type { UpdateChickBatchDto } from './dto/update-chick-batch.dto';

const CODE_PREFIX_BASE = 'POU';
const CODE_DIGITS = 3;
const MAX_CODE_RETRIES = 3;
const CONFIRMED_SALE_STATUSES: Prisma.SaleWhereInput['status'] = {
  in: ['CONFIRMEE', 'PAYEE', 'PARTIELLEMENT_PAYEE', 'IMPAYEE'],
};

export interface ChickBatchWithComputed extends ChickBatch {
  /** null pour purpose=RENOUVELLEMENT (jamais vendu, pas de notion d'effectif "restant à vendre"). */
  currentHeadcount: number | null;
}

/** Pas de CREATE exposé via controller : un ChickBatch naît toujours d'une
 * orientation (voir OrientationService) — createInternal() est appelé
 * depuis là, jamais depuis un formulaire libre. */
@Injectable()
export class ChickBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async generateBatchCode(farmId: string, year: number): Promise<string> {
    const prefix = `${CODE_PREFIX_BASE}-${year}-`;
    const last = await this.prisma.chickBatch.findFirst({
      where: { farmId, code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  /**
   * `tx` optionnel : voir BroilerBatchesService.create() pour le même
   * mécanisme (participation à une transaction englobante — orientation
   * Phase 5). Quand `tx` est fourni, l'écriture utilise ce client au lieu
   * de `this.prisma`, et le log d'audit n'est PAS écrit ici (l'appelant
   * journalise après le commit de sa propre transaction).
   */
  async createInternal(
    actingUser: AccessTokenPayload,
    input: { purpose: ChickBatchPurpose; initialQuantity: number; buildingId?: string },
    ipAddress: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<ChickBatch> {
    const client = tx ?? this.prisma;
    const year = new Date().getFullYear();
    let batch: ChickBatch | undefined;
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateBatchCode(actingUser.farmId, year);
      try {
        batch = await client.chickBatch.create({
          data: {
            farmId: actingUser.farmId,
            code,
            purpose: input.purpose,
            initialQuantity: input.initialQuantity,
            buildingId: input.buildingId,
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

    if (tx) {
      return batch;
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'chick_batch',
      entityId: batch.id,
      action: 'CHICK_BATCH_CREATED',
      newValues: {
        code: batch.code,
        purpose: input.purpose,
        initialQuantity: input.initialQuantity,
      },
      ipAddress,
    });

    return batch;
  }

  private async attachComputedFields(batch: ChickBatch): Promise<ChickBatchWithComputed> {
    if (batch.purpose !== 'VENTE') {
      return { ...batch, currentHeadcount: null };
    }
    const soldAgg = await this.prisma.sale.aggregate({
      where: { chickBatchId: batch.id, status: CONFIRMED_SALE_STATUSES },
      _sum: { quantity: true },
    });
    const currentHeadcount = computeChickCurrentHeadcount(
      batch.initialQuantity,
      soldAgg._sum.quantity ?? 0,
    );
    return { ...batch, currentHeadcount };
  }

  async findAll(actingUser: AccessTokenPayload): Promise<ChickBatchWithComputed[]> {
    const batches = await this.prisma.chickBatch.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(batches.map((batch) => this.attachComputedFields(batch)));
  }

  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<ChickBatch> {
    const batch = await this.prisma.chickBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Lot de poussins introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
    return batch;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<ChickBatchWithComputed> {
    const batch = await this.getRaw(actingUser, id);
    return this.attachComputedFields(batch);
  }

  /** Usage interne (SalesService) : lève 404 si hors farm, pas de champs calculés. */
  async findRawForFarm(farmId: string, id: string): Promise<ChickBatch> {
    const batch = await this.prisma.chickBatch.findUnique({ where: { id } });
    if (!batch || batch.farmId !== farmId) {
      throw new NotFoundException('Lot de poussins introuvable.');
    }
    return batch;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateChickBatchDto,
    ipAddress: string | null,
  ): Promise<ChickBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const updated = await this.prisma.chickBatch.update({ where: { id }, data: { ...dto } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'chick_batch',
      entityId: id,
      action: 'CHICK_BATCH_UPDATED',
      oldValues: { status: existing.status },
      newValues: { ...dto },
      ipAddress,
    });
    return this.attachComputedFields(updated);
  }
}
