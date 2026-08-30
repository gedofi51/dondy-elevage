import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type MaintenanceTask } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { MaintenanceTaskGenerationService } from './maintenance-task-generation.service';
import type { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import type { UpdateMaintenanceTaskDto } from './dto/update-maintenance-task.dto';
import type { CancelMaintenanceTaskDto } from './dto/cancel-maintenance-task.dto';

const TERMINAL_STATUSES = ['REALISEE', 'ANNULEE'];
const MAX_TRANSACTION_RETRIES = 3;

/** Même seuil que StockMovementsService/SalesService/etc. — voir
 * DETTE_TECHNIQUE.md Phase 20 (7e occurrence du défaut "vérification
 * sans verrou" déjà corrigé 6 fois en Phase 8).
 *
 * P2034 = conflit/deadlock détecté par Prisma au niveau ORM. P2010 =
 * "Raw query failed", code générique remonté quand le deadlock survient
 * DANS un `$queryRaw` (ex. `lockAndAssertTaskOpenInTransaction`
 * ci-dessous) — le vrai code MySQL (1213 deadlock / 1205 lock wait
 * timeout) est niché dans `meta.driverAdapterError.cause.originalCode`,
 * jamais exposé comme P2034. Trouvé en vérification manuelle Phase 20 —
 * voir DETTE_TECHNIQUE.md et le même correctif dans
 * MaintenanceInterventionsService. */
function isSerializationFailure(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code === 'P2034') {
    return true;
  }
  if (error.code === 'P2010') {
    const meta = error.meta as
      { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
    const originalCode = meta?.driverAdapterError?.cause?.originalCode;
    return originalCode === '1213' || originalCode === '1205';
  }
  return false;
}

interface LockedTaskRow {
  id: string;
  status: string;
  planId: string | null;
}

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

  /** Verrouille la ligne MaintenanceTask (`SELECT ... FOR UPDATE`, même
   * pattern que MaintenanceTaskGenerationService.ensureNextTaskGenerated
   * sur maintenance_plans) avant de vérifier son statut — corrige la 7e
   * occurrence du défaut "lecture-comparaison-écriture sans verrou" déjà
   * corrigé 6 fois en Phase 8 (voir DETTE_TECHNIQUE.md Phase 20).
   * Aucun filtre farmId dans la requête : la validation farm de la
   * tâche a déjà été faite par l'appelant avant l'ouverture de la
   * transaction (getRaw() côté cancel(), validation explicite côté
   * MaintenanceInterventionsService.create()) — contrat identique à
   * l'ancien markRealizedInTransaction, PAS celui de
   * StockMovementsService.recordMovementInTransaction (qui filtre
   * farmId faute de pré-check par son propre appelant). `tx`
   * obligatoire : ne doit jamais s'exécuter hors d'une transaction déjà
   * ouverte par l'appelant. */
  private async lockAndAssertTaskOpenInTransaction(
    tx: Prisma.TransactionClient,
    taskId: string,
  ): Promise<LockedTaskRow> {
    const rows = await tx.$queryRaw<LockedTaskRow[]>`
      SELECT id, status, planId FROM maintenance_tasks
      WHERE id = ${taskId}
      FOR UPDATE
    `;
    const locked = rows[0];
    if (!locked) {
      throw new NotFoundException('Tâche de maintenance introuvable.');
    }
    if (TERMINAL_STATUSES.includes(locked.status)) {
      throw new ConflictException('Cette tâche de maintenance est déjà clôturée.');
    }
    return locked;
  }

  /** Statut terminal — seul chemin vers ANNULEE (voir UpdateMaintenanceTaskDto
   * qui l'exclut explicitement). Si la tâche appartient à un plan, régénère
   * immédiatement la tâche suivante dans la même transaction (voir
   * DETTE_TECHNIQUE.md Phase 17, décision C.1 : jamais différé au cron).
   * Enveloppé dans une boucle retry P2034 par cohérence avec le reste du
   * projet — pas une nécessité technique stricte ici (un verrou sur une
   * seule ligne, clé primaire, ne peut pas produire de deadlock à lui
   * seul ; une transaction concurrente attend simplement la libération du
   * verrou, elle n'est jamais avortée — voir DETTE_TECHNIQUE.md Phase 20). */
  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    dto: CancelMaintenanceTaskDto,
    ipAddress: string | null,
  ): Promise<MaintenanceTaskWithComputed> {
    // Pré-check farm/existence hors transaction (même patron que
    // SalesService) — le statut réel est revérifié sous verrou ci-dessous.
    // farmId capturé ici (pas actingUser.farmId) pour rester correct côté
    // Super Admin cross-tenant, qui contourne assertSameFarm.
    const existing = await this.getRaw(actingUser, id);

    let updated: MaintenanceTask | undefined;
    let oldStatus: string | undefined;
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        updated = await this.prisma.$transaction(async (tx) => {
          const locked = await this.lockAndAssertTaskOpenInTransaction(tx, id);
          oldStatus = locked.status;
          const cancelled = await tx.maintenanceTask.update({
            where: { id },
            data: { status: 'ANNULEE', cancelReason: dto.cancelReason },
          });
          if (cancelled.planId) {
            await this.generationService.ensureNextTaskGenerated(tx, cancelled.planId);
          }
          return cancelled;
        });
        break;
      } catch (error) {
        if (error instanceof ConflictException || error instanceof NotFoundException) {
          throw error;
        }
        if (isSerializationFailure(error) && attempt < MAX_TRANSACTION_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    // updated est garanti défini ici : la boucle se termine soit par
    // `break` après une affectation réussie, soit par un `throw`.
    const finalTask = updated!;

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_task',
      entityId: id,
      action: 'MAINTENANCE_TASK_CANCELLED',
      oldValues: { status: oldStatus },
      newValues: { status: 'ANNULEE', cancelReason: dto.cancelReason },
      ipAddress,
    });

    return this.attachComputed(finalTask);
  }

  /** Appelée par MaintenanceInterventionsService.create() dans sa propre
   * transaction (déjà enveloppée dans sa propre boucle retry, voir
   * DETTE_TECHNIQUE.md Phase 20) — la validation farm/actif de la tâche a
   * déjà été faite par l'appelant. Statut terminal — 409 si déjà
   * REALISEE/ANNULEE, désormais vérifié sous verrou (voir
   * lockAndAssertTaskOpenInTransaction). Régénère immédiatement la tâche
   * suivante si la tâche appartient à un plan (voir DETTE_TECHNIQUE.md
   * Phase 17, décision C.1). */
  async markRealizedInTransaction(
    tx: Prisma.TransactionClient,
    taskId: string,
  ): Promise<MaintenanceTask> {
    await this.lockAndAssertTaskOpenInTransaction(tx, taskId);

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
