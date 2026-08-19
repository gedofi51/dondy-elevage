import { Injectable, NotFoundException } from '@nestjs/common';
import type { LayerHealthEvent } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import type { CreateHealthEventDto } from './dto/create-health-event.dto';
import type { UpdateHealthEventDto } from './dto/update-health-event.dto';

/** Dupliqué depuis broiler-batches/health-events (PAS généralisé) — décision
 * tranchée du plan Phase 4 : CRUD mécanique sans transition d'état à
 * partager, généraliser aurait obligé à toucher un module Phase 3
 * déjà mergé/testé pour un bénéfice quasi nul. */
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
    const batch = await this.prisma.layerBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException('Lot introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
  }

  async create(
    actingUser: AccessTokenPayload,
    batchId: string,
    dto: CreateHealthEventDto,
    ipAddress: string | null,
  ): Promise<LayerHealthEvent> {
    await this.assertBatchAccessible(actingUser, batchId);

    const event = await this.prisma.layerHealthEvent.create({
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
      entityType: 'layer_health_event',
      entityId: event.id,
      action: 'HEALTH_EVENT_CREATED',
      newValues: { type: dto.type, status: dto.status },
      ipAddress,
    });

    return event;
  }

  async findAll(actingUser: AccessTokenPayload, batchId: string): Promise<LayerHealthEvent[]> {
    await this.assertBatchAccessible(actingUser, batchId);
    return this.prisma.layerHealthEvent.findMany({
      where: { batchId },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    batchId: string,
    id: string,
  ): Promise<LayerHealthEvent> {
    await this.assertBatchAccessible(actingUser, batchId);
    const event = await this.prisma.layerHealthEvent.findUnique({ where: { id } });
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
  ): Promise<LayerHealthEvent> {
    const existing = await this.findOne(actingUser, batchId, id);

    const updated = await this.prisma.layerHealthEvent.update({
      where: { id },
      data: { ...dto, date: dto.date ? new Date(dto.date) : undefined },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'layer_health_event',
      entityId: id,
      action: 'HEALTH_EVENT_UPDATED',
      oldValues: { status: existing.status, type: existing.type },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
