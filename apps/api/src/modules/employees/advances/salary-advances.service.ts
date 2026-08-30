import { Injectable, NotFoundException } from '@nestjs/common';
import type { SalaryAdvance } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { EmployeesService } from '../employees.service';
import type { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import type { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';
import { assertAdvanceEditable } from './salary-advances.validation';

/**
 * Avances sur salaire — pas de verrou `FOR UPDATE` nécessaire ici
 * (contrairement à PayrollService) : la création d'une avance est un
 * simple insert, jamais concurrente sur une ressource partagée. La
 * protection contre le double comptage lors d'une création concurrente
 * de deux relevés de paie pour le même employé vit côté
 * PayrollService (verrou sur la ligne Employee) — voir
 * DETTE_TECHNIQUE.md.
 */
@Injectable()
export class SalaryAdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly employeesService: EmployeesService,
  ) {}

  private async getRaw(employeeId: string, id: string): Promise<SalaryAdvance> {
    const advance = await this.prisma.salaryAdvance.findUnique({ where: { id } });
    if (!advance || advance.employeeId !== employeeId) {
      throw new NotFoundException('Avance sur salaire introuvable.');
    }
    return advance;
  }

  async create(
    actingUser: AccessTokenPayload,
    employeeId: string,
    dto: CreateSalaryAdvanceDto,
    ipAddress: string | null,
  ): Promise<SalaryAdvance> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);

    const advance = await this.prisma.salaryAdvance.create({
      data: {
        farmId: employee.farmId,
        employeeId,
        date: new Date(dto.date),
        amountFcfa: dto.amountFcfa,
        observations: dto.observations,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'salary_advance',
      entityId: advance.id,
      action: 'SALARY_ADVANCE_CREATED',
      newValues: { employeeId, date: dto.date, amountFcfa: dto.amountFcfa },
      ipAddress,
    });

    return advance;
  }

  async findAll(actingUser: AccessTokenPayload, employeeId: string): Promise<SalaryAdvance[]> {
    await this.employeesService.findOne(actingUser, employeeId);
    return this.prisma.salaryAdvance.findMany({
      where: { employeeId },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    employeeId: string,
    id: string,
  ): Promise<SalaryAdvance> {
    await this.employeesService.findOne(actingUser, employeeId);
    return this.getRaw(employeeId, id);
  }

  async update(
    actingUser: AccessTokenPayload,
    employeeId: string,
    id: string,
    dto: UpdateSalaryAdvanceDto,
    ipAddress: string | null,
  ): Promise<SalaryAdvance> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    const existing = await this.getRaw(employeeId, id);
    assertAdvanceEditable(existing.deductedInPayrollId);

    const updated = await this.prisma.salaryAdvance.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        amountFcfa: dto.amountFcfa,
        observations: dto.observations,
      },
    });

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'salary_advance',
      entityId: id,
      action: 'SALARY_ADVANCE_UPDATED',
      oldValues: { date: existing.date, amountFcfa: existing.amountFcfa },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
