import { Injectable, NotFoundException } from '@nestjs/common';
import type { Building } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateBuildingDto } from './dto/create-building.dto';
import type { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateBuildingDto,
    ipAddress: string | null,
  ): Promise<Building> {
    const building = await this.prisma.building.create({
      data: { ...dto, farmId: actingUser.farmId, createdBy: actingUser.sub },
    });
    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'building',
      entityId: building.id,
      action: 'BUILDING_CREATED',
      newValues: { ...dto },
      ipAddress,
    });
    return building;
  }

  async findAll(actingUser: AccessTokenPayload): Promise<Building[]> {
    return this.prisma.building.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Building> {
    const building = await this.prisma.building.findUnique({ where: { id } });
    if (!building) {
      throw new NotFoundException('Bâtiment introuvable.');
    }
    assertSameFarm(actingUser, building.farmId);
    return building;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateBuildingDto,
    ipAddress: string | null,
  ): Promise<Building> {
    const existing = await this.findOne(actingUser, id);
    const updated = await this.prisma.building.update({ where: { id }, data: dto });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'building',
      entityId: id,
      action: 'BUILDING_UPDATED',
      oldValues: { name: existing.name, type: existing.type, capacity: existing.capacity },
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
    await this.prisma.building.delete({ where: { id } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'building',
      entityId: id,
      action: 'BUILDING_DELETED',
      oldValues: { name: existing.name, type: existing.type },
      ipAddress,
    });
  }
}
