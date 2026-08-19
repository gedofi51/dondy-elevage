import { Injectable, NotFoundException } from '@nestjs/common';
import type { BroilerMortality } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import type { CreateMortalityDto } from './dto/create-mortality.dto';
import type { UpdateMortalityDto } from './dto/update-mortality.dto';

@Injectable()
export class MortalityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async assertBatchAccessible(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<void> {
    const batch = await this.prisma.broilerBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException('Bande introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
  }

  /**
   * Détail optionnel par cause — coexiste avec BroilerDailyRecord.mortalityQuantity
   * (valeur de référence rapide pour les calculs d'effectif). Une divergence
   * entre les deux est détectée et matérialisée en alerte par
   * BroilerAlertsCronService, pas ici (un seul endroit pour cette logique).
   */
  async create(
    actingUser: AccessTokenPayload,
    batchId: string,
    dto: CreateMortalityDto,
    ipAddress: string | null,
  ): Promise<BroilerMortality> {
    await this.assertBatchAccessible(actingUser, batchId);

    const mortality = await this.prisma.broilerMortality.create({
      data: {
        farmId: actingUser.farmId,
        batchId,
        date: new Date(dto.date),
        dayNumber: dto.dayNumber,
        quantity: dto.quantity,
        cause: dto.cause,
        observation: dto.observation,
        recordedBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_mortality',
      entityId: mortality.id,
      action: 'MORTALITY_CREATED',
      newValues: { dayNumber: dto.dayNumber, quantity: dto.quantity, cause: dto.cause },
      ipAddress,
    });

    return mortality;
  }

  async findAll(actingUser: AccessTokenPayload, batchId: string): Promise<BroilerMortality[]> {
    await this.assertBatchAccessible(actingUser, batchId);
    return this.prisma.broilerMortality.findMany({
      where: { batchId, deletedAt: null },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    batchId: string,
    id: string,
  ): Promise<BroilerMortality> {
    await this.assertBatchAccessible(actingUser, batchId);
    const mortality = await this.prisma.broilerMortality.findUnique({ where: { id } });
    if (!mortality || mortality.batchId !== batchId || mortality.deletedAt) {
      throw new NotFoundException('Mortalité introuvable.');
    }
    assertSameFarm(actingUser, mortality.farmId);
    return mortality;
  }

  async update(
    actingUser: AccessTokenPayload,
    batchId: string,
    id: string,
    dto: UpdateMortalityDto,
    ipAddress: string | null,
  ): Promise<BroilerMortality> {
    const existing = await this.findOne(actingUser, batchId, id);

    const updated = await this.prisma.broilerMortality.update({
      where: { id },
      data: { ...dto, date: dto.date ? new Date(dto.date) : undefined },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_mortality',
      entityId: id,
      action: 'MORTALITY_UPDATED',
      oldValues: { quantity: existing.quantity, cause: existing.cause },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }

  /** Donnée sanitaire — soft delete uniquement (voir docs/reference/BASE_DE-DONNEES.md). */
  async remove(
    actingUser: AccessTokenPayload,
    batchId: string,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, batchId, id);
    await this.prisma.broilerMortality.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_mortality',
      entityId: id,
      action: 'MORTALITY_DELETED',
      oldValues: { quantity: existing.quantity, cause: existing.cause },
      ipAddress,
    });
  }
}
