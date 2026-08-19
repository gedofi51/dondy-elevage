import { Injectable, NotFoundException } from '@nestjs/common';
import type { Incubator } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateIncubatorDto } from './dto/create-incubator.dto';
import type { UpdateIncubatorDto } from './dto/update-incubator.dto';

/** Donnée de référence (comme Building/Supplier) : hard delete, pas de
 * deletedAt — équipement technique, pas une donnée financière/sanitaire. */
@Injectable()
export class IncubatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateIncubatorDto,
    ipAddress: string | null,
  ): Promise<Incubator> {
    const incubator = await this.prisma.incubator.create({
      data: { ...dto, farmId: actingUser.farmId, createdBy: actingUser.sub },
    });
    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'incubator',
      entityId: incubator.id,
      action: 'INCUBATOR_CREATED',
      newValues: { ...dto },
      ipAddress,
    });
    return incubator;
  }

  async findAll(actingUser: AccessTokenPayload): Promise<Incubator[]> {
    return this.prisma.incubator.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Incubator> {
    const incubator = await this.prisma.incubator.findUnique({ where: { id } });
    if (!incubator) {
      throw new NotFoundException('Couveuse introuvable.');
    }
    assertSameFarm(actingUser, incubator.farmId);
    return incubator;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateIncubatorDto,
    ipAddress: string | null,
  ): Promise<Incubator> {
    const existing = await this.findOne(actingUser, id);
    const updated = await this.prisma.incubator.update({ where: { id }, data: dto });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'incubator',
      entityId: id,
      action: 'INCUBATOR_UPDATED',
      oldValues: { name: existing.name, capacityEggs: existing.capacityEggs },
      newValues: { ...dto },
      ipAddress,
    });
    return updated;
  }

  async remove(actingUser: AccessTokenPayload, id: string, ipAddress: string | null): Promise<void> {
    const existing = await this.findOne(actingUser, id);
    await this.prisma.incubator.delete({ where: { id } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'incubator',
      entityId: id,
      action: 'INCUBATOR_DELETED',
      oldValues: { name: existing.name },
      ipAddress,
    });
  }
}
