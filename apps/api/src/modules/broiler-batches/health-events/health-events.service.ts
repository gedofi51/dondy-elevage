import { Injectable, NotFoundException } from '@nestjs/common';
import type { BroilerHealthEvent } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import type { CreateHealthEventDto } from './dto/create-health-event.dto';
import type { UpdateHealthEventDto } from './dto/update-health-event.dto';

@Injectable()
export class HealthEventsService {
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

  async create(
    actingUser: AccessTokenPayload,
    batchId: string,
    dto: CreateHealthEventDto,
    ipAddress: string | null,
  ): Promise<BroilerHealthEvent> {
    await this.assertBatchAccessible(actingUser, batchId);

    const event = await this.prisma.broilerHealthEvent.create({
      data: {
        farmId: actingUser.farmId,
        batchId,
        date: new Date(dto.date),
        status: dto.status,
        type: dto.type,
        product: dto.product,
        motif: dto.motif,
        dose: dto.dose,
        quantity: dto.quantity,
        unit: dto.unit,
        durationDays: dto.durationDays,
        administrationRoute: dto.administrationRoute,
        prescribedBy: dto.prescribedBy,
        performedBy: dto.performedBy,
        costFcfa: dto.costFcfa,
        observation: dto.observation,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_health_event',
      entityId: event.id,
      action: 'HEALTH_EVENT_CREATED',
      newValues: { type: dto.type, status: dto.status },
      ipAddress,
    });

    return event;
  }

  async findAll(actingUser: AccessTokenPayload, batchId: string): Promise<BroilerHealthEvent[]> {
    await this.assertBatchAccessible(actingUser, batchId);
    return this.prisma.broilerHealthEvent.findMany({
      where: { batchId },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    batchId: string,
    id: string,
  ): Promise<BroilerHealthEvent> {
    await this.assertBatchAccessible(actingUser, batchId);
    const event = await this.prisma.broilerHealthEvent.findUnique({ where: { id } });
    if (!event || event.batchId !== batchId) {
      throw new NotFoundException('Événement sanitaire introuvable.');
    }
    assertSameFarm(actingUser, event.farmId);
    return event;
  }

  async update(
    actingUser: AccessTokenPayload,
    batchId: string,
    id: string,
    dto: UpdateHealthEventDto,
    ipAddress: string | null,
  ): Promise<BroilerHealthEvent> {
    const existing = await this.findOne(actingUser, batchId, id);

    const updated = await this.prisma.broilerHealthEvent.update({
      where: { id },
      data: { ...dto, date: dto.date ? new Date(dto.date) : undefined },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_health_event',
      entityId: id,
      action: 'HEALTH_EVENT_UPDATED',
      oldValues: { status: existing.status, type: existing.type },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
