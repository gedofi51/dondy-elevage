import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmployeeTask } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { EmployeesService } from '../employees.service';
import type { CreateEmployeeTaskDto } from './dto/create-employee-task.dto';
import type { UpdateEmployeeTaskDto } from './dto/update-employee-task.dto';
import type { CancelEmployeeTaskDto } from './dto/cancel-employee-task.dto';
import {
  assertEmployeeActiveForNewTask,
  computeIsLate,
  TERMINAL_TASK_STATUSES,
} from './employee-tasks.validation';

export interface EmployeeTaskWithComputed extends EmployeeTask {
  /** dueDate dépassée ET statut encore ouvert — calculé à la lecture,
   * jamais stocké, même patron que MaintenanceTasksService (Phase 17). */
  isLate: boolean;
}

/**
 * Tâches assignées à un employé — module autonome, aucun moteur de
 * tâches transverse trouvé dans le dépôt (voir DETTE_TECHNIQUE.md Lot 4 :
 * Alert/Notification sont un pipeline d'alertes, pas d'assignation).
 * Même patron structurel que MaintenanceTasksService (statuts
 * terminaux protégés, "en retard" calculé), adapté : REALISEE reste
 * directement accessible en PATCH faute d'équivalent à
 * MaintenanceIntervention pour le produire en effet de bord ; ANNULEE
 * reste isolé dans son propre endpoint. Pas de verrou `FOR UPDATE` :
 * contrairement à MaintenanceTask, aucun risque de concurrence réel
 * identifié (pas d'entité liée créée en side-effect) — décision
 * proportionnée, pas un oubli, voir DETTE_TECHNIQUE.md.
 */
@Injectable()
export class EmployeeTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly employeesService: EmployeesService,
  ) {}

  private attachComputed(task: EmployeeTask): EmployeeTaskWithComputed {
    return { ...task, isLate: computeIsLate(task.status, task.dueDate) };
  }

  private async getRaw(employeeId: string, id: string): Promise<EmployeeTask> {
    const task = await this.prisma.employeeTask.findUnique({ where: { id } });
    if (!task || task.employeeId !== employeeId) {
      throw new NotFoundException('Tâche introuvable.');
    }
    return task;
  }

  async create(
    actingUser: AccessTokenPayload,
    employeeId: string,
    dto: CreateEmployeeTaskDto,
    ipAddress: string | null,
  ): Promise<EmployeeTaskWithComputed> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    assertEmployeeActiveForNewTask(employee.status);

    const task = await this.prisma.employeeTask.create({
      data: {
        farmId: employee.farmId,
        employeeId,
        designation: dto.designation,
        dueDate: new Date(dto.dueDate),
        observations: dto.observations,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'employee_task',
      entityId: task.id,
      action: 'EMPLOYEE_TASK_CREATED',
      newValues: { employeeId, designation: dto.designation, dueDate: dto.dueDate },
      ipAddress,
    });

    return this.attachComputed(task);
  }

  async findAll(
    actingUser: AccessTokenPayload,
    employeeId: string,
  ): Promise<EmployeeTaskWithComputed[]> {
    await this.employeesService.findOne(actingUser, employeeId);
    const tasks = await this.prisma.employeeTask.findMany({
      where: { employeeId },
      orderBy: { dueDate: 'asc' },
    });
    return tasks.map((task) => this.attachComputed(task));
  }

  async findOne(
    actingUser: AccessTokenPayload,
    employeeId: string,
    id: string,
  ): Promise<EmployeeTaskWithComputed> {
    await this.employeesService.findOne(actingUser, employeeId);
    return this.attachComputed(await this.getRaw(employeeId, id));
  }

  async update(
    actingUser: AccessTokenPayload,
    employeeId: string,
    id: string,
    dto: UpdateEmployeeTaskDto,
    ipAddress: string | null,
  ): Promise<EmployeeTaskWithComputed> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    const existing = await this.getRaw(employeeId, id);
    if (TERMINAL_TASK_STATUSES.includes(existing.status)) {
      throw new ConflictException('Cette tâche est déjà clôturée.');
    }

    const updated = await this.prisma.employeeTask.update({
      where: { id },
      data: {
        designation: dto.designation,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        observations: dto.observations,
      },
    });

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'employee_task',
      entityId: id,
      action: 'EMPLOYEE_TASK_UPDATED',
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

  async cancel(
    actingUser: AccessTokenPayload,
    employeeId: string,
    id: string,
    dto: CancelEmployeeTaskDto,
    ipAddress: string | null,
  ): Promise<EmployeeTaskWithComputed> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    const existing = await this.getRaw(employeeId, id);
    if (TERMINAL_TASK_STATUSES.includes(existing.status)) {
      throw new ConflictException('Cette tâche est déjà clôturée.');
    }

    const cancelled = await this.prisma.employeeTask.update({
      where: { id },
      data: { status: 'ANNULEE', cancelReason: dto.cancelReason },
    });

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'employee_task',
      entityId: id,
      action: 'EMPLOYEE_TASK_CANCELLED',
      oldValues: { status: existing.status },
      newValues: { status: 'ANNULEE', cancelReason: dto.cancelReason },
      ipAddress,
    });

    return this.attachComputed(cancelled);
  }
}
