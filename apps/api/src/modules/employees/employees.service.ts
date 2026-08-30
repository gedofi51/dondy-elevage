import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import { assertDatesConsistent, assertUpdateAllowed } from './employees.validation';

const CODE_PREFIX_BASE = 'EMP';
const CODE_DIGITS = 3;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Dérivé du dernier code émis (jamais d'un COUNT(*), même patron que
   * AssetsService.generateCode()/CustomersService). Année = année
   * d'embauche (comme Asset : année du champ métier, pas la date
   * système). */
  private async generateCode(farmId: string, year: number): Promise<string> {
    const prefix = `${CODE_PREFIX_BASE}-${year}-`;
    const last = await this.prisma.employee.findFirst({
      where: { farmId, code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  private async assertBuildingBelongsToFarm(farmId: string, buildingId: string): Promise<void> {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!building || building.farmId !== farmId) {
      throw new NotFoundException('Bâtiment introuvable.');
    }
  }

  private async assertManagerBelongsToFarm(farmId: string, managerId: string): Promise<void> {
    const manager = await this.prisma.employee.findUnique({ where: { id: managerId } });
    if (!manager || manager.farmId !== farmId) {
      throw new NotFoundException('Responsable hiérarchique introuvable.');
    }
  }

  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<Employee> {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.deletedAt) {
      throw new NotFoundException('Employé introuvable.');
    }
    assertSameFarm(actingUser, employee.farmId);
    return employee;
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateEmployeeDto,
    ipAddress: string | null,
  ): Promise<Employee> {
    const hireDate = new Date(dto.hireDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    assertDatesConsistent(hireDate, endDate);

    if (dto.buildingId) {
      await this.assertBuildingBelongsToFarm(actingUser.farmId, dto.buildingId);
    }
    if (dto.managerId) {
      await this.assertManagerBelongsToFarm(actingUser.farmId, dto.managerId);
    }

    const code = await this.generateCode(actingUser.farmId, hireDate.getFullYear());

    const employee = await this.prisma.employee.create({
      data: {
        farmId: actingUser.farmId,
        code,
        buildingId: dto.buildingId,
        managerId: dto.managerId,
        name: dto.name,
        position: dto.position,
        contractType: dto.contractType,
        phone: dto.phone,
        hireDate,
        endDate,
        baseSalaryFcfa: dto.baseSalaryFcfa,
        observations: dto.observations,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'employee',
      entityId: employee.id,
      action: 'EMPLOYEE_CREATED',
      newValues: {
        code,
        name: dto.name,
        position: dto.position,
        baseSalaryFcfa: dto.baseSalaryFcfa,
      },
      ipAddress,
    });

    return employee;
  }

  async findAll(actingUser: AccessTokenPayload): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: { farmId: actingUser.farmId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Employee> {
    return this.getRaw(actingUser, id);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateEmployeeDto,
    ipAddress: string | null,
  ): Promise<Employee> {
    const existing = await this.getRaw(actingUser, id);
    assertUpdateAllowed(existing.status, dto);

    if (dto.managerId === id) {
      throw new BadRequestException('Un employé ne peut pas être son propre responsable.');
    }
    if (dto.buildingId) {
      await this.assertBuildingBelongsToFarm(actingUser.farmId, dto.buildingId);
    }
    if (dto.managerId) {
      await this.assertManagerBelongsToFarm(actingUser.farmId, dto.managerId);
    }

    const hireDate = dto.hireDate ? new Date(dto.hireDate) : existing.hireDate;
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : dto.endDate === undefined
        ? existing.endDate
        : null;
    assertDatesConsistent(hireDate, endDate);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        buildingId: dto.buildingId,
        managerId: dto.managerId,
        name: dto.name,
        position: dto.position,
        contractType: dto.contractType,
        phone: dto.phone,
        hireDate: dto.hireDate ? hireDate : undefined,
        endDate: dto.endDate !== undefined ? endDate : undefined,
        status: dto.status,
        baseSalaryFcfa: dto.baseSalaryFcfa,
        observations: dto.observations,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'employee',
      entityId: id,
      action: 'EMPLOYEE_UPDATED',
      oldValues: {
        name: existing.name,
        position: existing.position,
        status: existing.status,
        baseSalaryFcfa: existing.baseSalaryFcfa,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }

  /** Donnée RH — soft delete uniquement, jamais de suppression
   * définitive (même discipline qu'Expense/SupplierPayment). */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.getRaw(actingUser, id);
    await this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'employee',
      entityId: id,
      action: 'EMPLOYEE_DELETED',
      oldValues: { code: existing.code, name: existing.name },
      ipAddress,
    });
  }
}
