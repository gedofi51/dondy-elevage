import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type BreederBatch, type BreederBatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { computeAvailableFertileEggs } from './calculations/breeder-eggs.calculations';
import type { CreateBreederBatchDto } from './dto/create-breeder-batch.dto';
import type { UpdateBreederBatchDto } from './dto/update-breeder-batch.dto';

const CODE_PREFIX_BASE = 'REP';
const CODE_DIGITS = 3;
const MAX_CODE_RETRIES = 3;
/** Une incubation annulée n'a jamais réellement consommé d'œufs — exclue du
 * cumul "déjà consommé", même logique que les ventes ANNULEE exclues du
 * calcul d'effectif sur Broiler/Layer. */
const NON_CANCELLED_INCUBATION_STATUSES: Prisma.IncubationBatchWhereInput['status'] = {
  not: 'ANNULEE',
};

export interface BreederBatchWithComputed extends BreederBatch {
  availableFertileEggs: number;
}

@Injectable()
export class BreederBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Dérivé du dernier code émis pour la ferme+année (REP-AAAA-NNN), avec
   * retry sur conflit P2002 — pattern CustomersService.generateCode. */
  private async generateBatchCode(farmId: string, year: number): Promise<string> {
    const prefix = `${CODE_PREFIX_BASE}-${year}-`;
    const last = await this.prisma.breederBatch.findFirst({
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

  /** §6.2/§6.3 : quantité d'œufs fécondés disponible pour incubation —
   * jamais stockée, toujours dérivée (voir BreederDailyRecord). */
  async computeAvailableFertileEggsForBatch(batchId: string): Promise<number> {
    const [dailyAgg, incubationAgg] = await Promise.all([
      this.prisma.breederDailyRecord.aggregate({
        where: { batchId },
        _sum: { eggsSelectedForIncubation: true },
      }),
      this.prisma.incubationBatch.aggregate({
        where: { breederBatchId: batchId, status: NON_CANCELLED_INCUBATION_STATUSES },
        _sum: { eggCount: true },
      }),
    ]);
    return computeAvailableFertileEggs(
      dailyAgg._sum.eggsSelectedForIncubation ?? 0,
      incubationAgg._sum.eggCount ?? 0,
    );
  }

  private async attachComputedFields(batch: BreederBatch): Promise<BreederBatchWithComputed> {
    const availableFertileEggs = await this.computeAvailableFertileEggsForBatch(batch.id);
    return { ...batch, availableFertileEggs };
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateBreederBatchDto,
    ipAddress: string | null,
  ): Promise<BreederBatchWithComputed> {
    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      buildingId: dto.buildingId,
      primaryManagerId: dto.primaryManagerId,
    });

    const constitutionDate = new Date(dto.constitutionDate);

    let batch: BreederBatch | undefined;
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateBatchCode(actingUser.farmId, constitutionDate.getFullYear());
      try {
        batch = await this.prisma.breederBatch.create({
          data: {
            farmId: actingUser.farmId,
            code,
            strain: dto.strain,
            constitutionDate,
            femaleCount: dto.femaleCount,
            maleCount: dto.maleCount,
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
      entityType: 'breeder_batch',
      entityId: batch.id,
      action: 'BREEDER_BATCH_CREATED',
      newValues: {
        code: batch.code,
        femaleCount: batch.femaleCount,
        maleCount: batch.maleCount,
        buildingId: batch.buildingId,
      },
      ipAddress,
    });

    return this.attachComputedFields(batch);
  }

  async findAll(actingUser: AccessTokenPayload): Promise<BreederBatchWithComputed[]> {
    const batches = await this.prisma.breederBatch.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(batches.map((batch) => this.attachComputedFields(batch)));
  }

  /** Usage interne (update/remove/annuler/clôturer) : pas de champs calculés. */
  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<BreederBatch> {
    const batch = await this.prisma.breederBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Lot introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
    return batch;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<BreederBatchWithComputed> {
    const batch = await this.getRaw(actingUser, id);
    return this.attachComputedFields(batch);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateBreederBatchDto,
    ipAddress: string | null,
  ): Promise<BreederBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      buildingId: dto.buildingId,
      primaryManagerId: dto.primaryManagerId,
    });

    const updated = await this.prisma.breederBatch.update({
      where: { id },
      data: {
        ...dto,
        constitutionDate: dto.constitutionDate ? new Date(dto.constitutionDate) : undefined,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'breeder_batch',
      entityId: id,
      action: 'BREEDER_BATCH_UPDATED',
      oldValues: {
        status: existing.status,
        femaleCount: existing.femaleCount,
        maleCount: existing.maleCount,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputedFields(updated);
  }

  /**
   * Suppression définitive — uniquement si le lot n'a aucune journée de
   * production ni aucun lot d'incubation lié (pas d'Expense/Sale sur
   * BreederBatch, contrairement à Broiler/Layer — hors périmètre Phase 5).
   * Dans tous les autres cas : POST /:id/annuler.
   */
  async remove(actingUser: AccessTokenPayload, id: string, ipAddress: string | null): Promise<void> {
    const existing = await this.getRaw(actingUser, id);

    const [dailyRecordCount, incubationCount] = await Promise.all([
      this.prisma.breederDailyRecord.count({ where: { batchId: id } }),
      this.prisma.incubationBatch.count({ where: { breederBatchId: id } }),
    ]);
    if (dailyRecordCount > 0 || incubationCount > 0) {
      throw new ConflictException(
        "Impossible de supprimer un lot avec des journées de production ou des lots d'incubation enregistrés — utiliser l'annulation (POST /:id/annuler).",
      );
    }

    await this.prisma.breederBatch.delete({ where: { id } });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'breeder_batch',
      entityId: id,
      action: 'BREEDER_BATCH_DELETED',
      oldValues: { code: existing.code, status: existing.status },
      ipAddress,
    });
  }

  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<BreederBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const updated = await this.setStatus(existing, 'ANNULEE', actingUser, 'BREEDER_BATCH_CANCELLED', ipAddress);
    return this.attachComputedFields(updated);
  }

  /** Pas de blocage sur un effectif restant (contrairement à Broiler) : la
   * réforme/vente des reproducteurs eux-mêmes est hors périmètre Phase 5 —
   * même raisonnement que LayerBatchesService.close(). */
  async close(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<BreederBatchWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const updated = await this.setStatus(existing, 'CLOTURE', actingUser, 'BREEDER_BATCH_CLOSED', ipAddress);
    return this.attachComputedFields(updated);
  }

  private async setStatus(
    existing: BreederBatch,
    status: BreederBatchStatus,
    actingUser: AccessTokenPayload,
    action: string,
    ipAddress: string | null,
  ): Promise<BreederBatch> {
    const updated = await this.prisma.breederBatch.update({ where: { id: existing.id }, data: { status } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'breeder_batch',
      entityId: existing.id,
      action,
      oldValues: { status: existing.status },
      newValues: { status },
      ipAddress,
    });
    return updated;
  }
}
