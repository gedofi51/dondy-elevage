import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateFarmDto } from './dto/create-farm.dto';
import type { UpdateFarmDto } from './dto/update-farm.dto';
import type { Farm } from '@prisma/client';

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Réservé aux acteurs avec `platform.manage` (Super Admin) — vérifié par le guard de permission au niveau du contrôleur. */
  async create(
    actingUser: AccessTokenPayload,
    dto: CreateFarmDto,
    ipAddress: string | null,
  ): Promise<Farm> {
    const farm = await this.prisma.farm.create({ data: dto });
    await this.auditLogService.record({
      farmId: farm.id,
      userId: actingUser.sub,
      entityType: 'farm',
      entityId: farm.id,
      action: 'FARM_CREATED',
      newValues: { ...dto },
      ipAddress,
    });
    return farm;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Farm> {
    const farm = await this.prisma.farm.findUnique({ where: { id } });
    if (!farm) {
      throw new NotFoundException('Ferme introuvable.');
    }
    assertSameFarm(actingUser, farm.id);
    return farm;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateFarmDto,
    ipAddress: string | null,
  ): Promise<Farm> {
    const existing = await this.prisma.farm.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Ferme introuvable.');
    }
    assertSameFarm(actingUser, existing.id);

    const updated = await this.prisma.farm.update({ where: { id }, data: dto });

    await this.auditLogService.record({
      farmId: id,
      userId: actingUser.sub,
      entityType: 'farm',
      entityId: id,
      action: 'FARM_UPDATED',
      oldValues: {
        name: existing.name,
        locality: existing.locality,
        currency: existing.currency,
        timezone: existing.timezone,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
