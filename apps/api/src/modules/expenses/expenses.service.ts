import { Injectable, NotFoundException } from '@nestjs/common';
import type { Expense } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';
import type { ListExpensesQueryDto } from './dto/list-expenses.query.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async assertReferencesBelongToFarm(
    farmId: string,
    refs: {
      batchId?: string;
      layerBatchId?: string;
      chickBatchId?: string;
      breederBatchId?: string;
      incubationBatchId?: string;
      waterPointId?: string;
      assetId?: string;
      supplierId?: string;
    },
  ): Promise<void> {
    if (refs.batchId) {
      const batch = await this.prisma.broilerBatch.findUnique({ where: { id: refs.batchId } });
      if (!batch || batch.farmId !== farmId) {
        throw new NotFoundException('Bande introuvable.');
      }
    }
    if (refs.layerBatchId) {
      const layerBatch = await this.prisma.layerBatch.findUnique({
        where: { id: refs.layerBatchId },
      });
      if (!layerBatch || layerBatch.farmId !== farmId) {
        throw new NotFoundException('Lot introuvable.');
      }
    }
    if (refs.chickBatchId) {
      const chickBatch = await this.prisma.chickBatch.findUnique({
        where: { id: refs.chickBatchId },
      });
      if (!chickBatch || chickBatch.farmId !== farmId) {
        throw new NotFoundException('Lot de poussins introuvable.');
      }
    }
    if (refs.breederBatchId) {
      const breederBatch = await this.prisma.breederBatch.findUnique({
        where: { id: refs.breederBatchId },
      });
      if (!breederBatch || breederBatch.farmId !== farmId) {
        throw new NotFoundException('Lot reproducteur introuvable.');
      }
    }
    if (refs.incubationBatchId) {
      const incubationBatch = await this.prisma.incubationBatch.findUnique({
        where: { id: refs.incubationBatchId },
      });
      if (!incubationBatch || incubationBatch.farmId !== farmId) {
        throw new NotFoundException("Lot d'incubation introuvable.");
      }
    }
    if (refs.waterPointId) {
      const waterPoint = await this.prisma.waterPoint.findUnique({
        where: { id: refs.waterPointId },
      });
      if (!waterPoint || waterPoint.farmId !== farmId) {
        throw new NotFoundException("Point d'eau introuvable.");
      }
    }
    if (refs.assetId) {
      const asset = await this.prisma.asset.findUnique({ where: { id: refs.assetId } });
      if (!asset || asset.farmId !== farmId) {
        throw new NotFoundException('Actif introuvable.');
      }
    }
    if (refs.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: refs.supplierId } });
      if (!supplier || supplier.farmId !== farmId) {
        throw new NotFoundException('Fournisseur introuvable.');
      }
    }
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateExpenseDto,
    ipAddress: string | null,
  ): Promise<Expense> {
    await this.assertReferencesBelongToFarm(actingUser.farmId, dto);

    const expense = await this.prisma.expense.create({
      data: {
        farmId: actingUser.farmId,
        batchId: dto.batchId,
        layerBatchId: dto.layerBatchId,
        chickBatchId: dto.chickBatchId,
        breederBatchId: dto.breederBatchId,
        incubationBatchId: dto.incubationBatchId,
        waterPointId: dto.waterPointId,
        assetId: dto.assetId,
        date: new Date(dto.date),
        category: dto.category,
        description: dto.description,
        quantity: dto.quantity,
        unitPriceFcfa: dto.unitPriceFcfa,
        amountFcfa: dto.amountFcfa,
        supplierId: dto.supplierId,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'expense',
      entityId: expense.id,
      action: 'EXPENSE_CREATED',
      newValues: { category: dto.category, amountFcfa: dto.amountFcfa, batchId: dto.batchId },
      ipAddress,
    });

    return expense;
  }

  async findAll(actingUser: AccessTokenPayload, query: ListExpensesQueryDto): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: {
        farmId: actingUser.farmId,
        deletedAt: null,
        batchId: query.batchId,
        layerBatchId: query.layerBatchId,
        chickBatchId: query.chickBatchId,
        breederBatchId: query.breederBatchId,
        incubationBatchId: query.incubationBatchId,
        waterPointId: query.waterPointId,
        assetId: query.assetId,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Expense> {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || expense.deletedAt) {
      throw new NotFoundException('Dépense introuvable.');
    }
    assertSameFarm(actingUser, expense.farmId);
    return expense;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateExpenseDto,
    ipAddress: string | null,
  ): Promise<Expense> {
    const existing = await this.findOne(actingUser, id);
    await this.assertReferencesBelongToFarm(actingUser.farmId, dto);

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { ...dto, date: dto.date ? new Date(dto.date) : undefined },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'expense',
      entityId: id,
      action: 'EXPENSE_UPDATED',
      oldValues: { category: existing.category, amountFcfa: existing.amountFcfa },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }

  /** Donnée financière — soft delete uniquement. */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);
    await this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'expense',
      entityId: id,
      action: 'EXPENSE_DELETED',
      oldValues: { category: existing.category, amountFcfa: existing.amountFcfa },
      ipAddress,
    });
  }
}
