import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { MaintenanceTask, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { MaintenanceTaskGenerationService } from './maintenance-task-generation.service';
import type { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import type { UpdateMaintenanceTaskDto } from './dto/update-maintenance-task.dto';
import type { CancelMaintenanceTaskDto } from './dto/cancel-maintenance-task.dto';

const TERMINAL_STATUSES = ['REALISEE', 'ANNULEE'];

export interface MaintenanceTaskWithComputed extends MaintenanceTask {
  /** dueDate dépassée ET statut encore ouvert — calculé à la lecture,
   * jamais stocké (voir DETTE_TECHNIQUE.md Phase 17, décision C.3). */
  isLate: boolean;
}

/**
 * Tâches préventives (planId renseigné, générées par le système — voir
 * MaintenancePlansService/MaintenanceTaskGenerationService) ou
 * corrective/conditionnelle (planId=null, créées manuellement via ce
 * service). REALISEE/ANNULEE sont des statuts terminaux protégés dès
 * l'origine (voir UpdateMaintenanceTaskDto) — REALISEE n'est atteignable
 * que comme effet de bord de la création d'une MaintenanceIntervention
 * (voir markRealizedInTransaction), ANNULEE uniquement via
 * POST /:id/annuler.
 */
@Injectable()
export class MaintenanceTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly generationService: MaintenanceTaskGenerationService,
  ) {}

  private attachComputed(task: MaintenanceTask): MaintenanceTaskWithComputed {
    const isLate = !TERMINAL_STATUSES.includes(task.status) && task.dueDate.getTime() < Date.now();
    return { ...task, isLate };
  }

  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<MaintenanceTask> {
    const task = await this.prisma.maintenanceTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Tâche de maintenance introuvable.');
    }
    assertSameFarm(actingUser, task.farmId);
    return task;
  }

  /** Création manuelle uniquement (corrective/conditionnelle) — planId
   * reste toujours null (voir CreateMaintenanceTaskDto). */
  async create(
    actingUser: AccessTokenPayload,
    dto: CreateMaintenanceTaskDto,
    ipAddress: string | null,
  ): Promise<MaintenanceTaskWithComputed> {
    const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
    if (!asset || asset.farmId !== actingUser.farmId) {
      throw new NotFoundException('Actif introuvable.');
    }
    if (asset.status === 'REFORME') {
      throw new ConflictException('Impossible de planifier une maintenance sur un actif réformé.');
    }

    const created = await this.prisma.maintenanceTask.create({
      data: {
        farmId: actingUser.farmId,
        assetId: dto.assetId,
        planId: null,
        type: dto.type,
        designation: dto.designation,
        dueDate: new Date(dto.dueDate),
        observations: dto.observations,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_task',
      entityId: created.id,
      action: 'MAINTENANCE_TASK_CREATED',
      newValues: { assetId: dto.assetId, type: dto.type, dueDate: dto.dueDate },
      ipAddress,
    });

    return this.attachComputed(created);
  }

  async findAll(actingUser: AccessTokenPayload): Promise<MaintenanceTaskWithComputed[]> {
    const tasks = await this.prisma.maintenanceTask.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { dueDate: 'asc' },
    });
    return tasks.map((task) => this.attachComputed(task));
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<MaintenanceTaskWithComputed> {
    return this.attachComputed(await this.getRaw(actingUser, id));
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateMaintenanceTaskDto,
    ipAddress: string | null,
  ): Promise<MaintenanceTaskWithComputed> {
    const existing = await this.getRaw(actingUser, id);

    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate !== undefined ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_task',
      entityId: id,
      action: 'MAINTENANCE_TASK_UPDATED',
      oldValues: {
        designation: existing.designation,
        dueDate: existing.dueDate,
        status: existing.status,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputed(updated);
  }

  /** Suppression définitive — uniquement si aucune intervention réelle
   * n'y est rattachée (garde-fou sur l'activité réelle, même gabarit que
   * AssetsService.remove()). */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.getRaw(actingUser, id);

    const interventionCount = await this.prisma.maintenanceIntervention.count({
      where: { taskId: id },
    });
    if (interventionCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer une tâche de maintenance avec une intervention enregistrée.',
      );
    }

    await this.prisma.maintenanceTask.delete({ where: { id } });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_task',
      entityId: id,
      action: 'MAINTENANCE_TASK_DELETED',
      oldValues: { designation: existing.designation, assetId: existing.assetId },
      ipAddress,
    });
  }

  /** Statut terminal — seul chemin vers ANNULEE (voir UpdateMaintenanceTaskDto
   * qui l'exclut explicitement). Si la tâche appartient à un plan, régénère
   * immédiatement la tâche suivante dans la même transaction (voir
   * DETTE_TECHNIQUE.md Phase 17, décision C.1 : jamais différé au cron). */
  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    dto: CancelMaintenanceTaskDto,
    ipAddress: string | null,
  ): Promise<MaintenanceTaskWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new ConflictException('Cette tâche de maintenance est déjà clôturée.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.maintenanceTask.update({
        where: { id },
        data: { status: 'ANNULEE', cancelReason: dto.cancelReason },
      });
      if (cancelled.planId) {
        await this.generationService.ensureNextTaskGenerated(tx, cancelled.planId);
      }
      return cancelled;
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_task',
      entityId: id,
      action: 'MAINTENANCE_TASK_CANCELLED',
      oldValues: { status: existing.status },
      newValues: { status: 'ANNULEE', cancelReason: dto.cancelReason },
      ipAddress,
    });

    return this.attachComputed(updated);
  }

  /** Appelée par MaintenanceInterventionsService.create() dans sa propre
   * transaction — la validation farm/actif de la tâche a déjà été faite
   * par l'appelant. Statut terminal — 409 si déjà REALISEE/ANNULEE.
   * Régénère immédiatement la tâche suivante si la tâche appartient à un
   * plan (voir DETTE_TECHNIQUE.md Phase 17, décision C.1). */
  async markRealizedInTransaction(
    tx: Prisma.TransactionClient,
    taskId: string,
  ): Promise<MaintenanceTask> {
    const existing = await tx.maintenanceTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      throw new NotFoundException('Tâche de maintenance introuvable.');
    }
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new ConflictException('Cette tâche de maintenance est déjà clôturée.');
    }

    const updated = await tx.maintenanceTask.update({
      where: { id: taskId },
      data: { status: 'REALISEE' },
    });
    if (updated.planId) {
      await this.generationService.ensureNextTaskGenerated(tx, updated.planId);
    }
    return updated;
  }
}
