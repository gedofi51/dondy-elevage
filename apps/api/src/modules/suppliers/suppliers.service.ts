import { Injectable, NotFoundException } from '@nestjs/common';
import type { Supplier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateSupplierDto,
    ipAddress: string | null,
  ): Promise<Supplier> {
    const supplier = await this.prisma.supplier.create({
      data: { ...dto, farmId: actingUser.farmId, createdBy: actingUser.sub },
    });
    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'supplier',
      entityId: supplier.id,
      action: 'SUPPLIER_CREATED',
      newValues: { ...dto },
      ipAddress,
    });
    return supplier;
  }

  async findAll(actingUser: AccessTokenPayload): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable.');
    }
    assertSameFarm(actingUser, supplier.farmId);
    return supplier;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateSupplierDto,
    ipAddress: string | null,
  ): Promise<Supplier> {
    const existing = await this.findOne(actingUser, id);
    const updated = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'supplier',
      entityId: id,
      action: 'SUPPLIER_UPDATED',
      oldValues: {
        name: existing.name,
        category: existing.category,
        contactName: existing.contactName,
        phone: existing.phone,
        address: existing.address,
      },
      newValues: { ...dto },
      ipAddress,
    });
    return updated;
  }

  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);
    await this.prisma.supplier.delete({ where: { id } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'supplier',
      entityId: id,
      action: 'SUPPLIER_DELETED',
      oldValues: { name: existing.name, category: existing.category },
      ipAddress,
    });
  }
}
