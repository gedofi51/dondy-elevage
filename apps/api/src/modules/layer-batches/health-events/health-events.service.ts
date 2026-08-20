import { Injectable, NotFoundException } from '@nestjs/common';
import type { HealthEventStatus, LayerHealthEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { StockMovementsService } from '../../stock-movements/stock-movements.service';
import { computeStockConsumptionInstructions } from '../../items/calculations/stock-consumption.calculations';
import type { CreateHealthEventDto } from './dto/create-health-event.dto';
import type { UpdateHealthEventDto } from './dto/update-health-event.dto';

/** Dupliqué depuis broiler-batches/health-events (PAS généralisé) — décision
 * tranchée du plan Phase 4 : CRUD mécanique sans transition d'état à
 * partager, généraliser aurait obligé à toucher un module Phase 3
 * déjà mergé/testé pour un bénéfice quasi nul. Le hook stock/Expense de
 * la Phase 7 reste donc dupliqué à l'identique, pas généralisé non plus. */
@Injectable()
export class HealthEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly stockMovementsService: StockMovementsService,
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

  /** Voir broiler-batches/health-events/health-events.service.ts pour la
   * justification complète (déclenchement uniquement sur status=REALISE). */
  private async applyHealthStockInstructions(
    tx: Prisma.TransactionClient,
    actingUser: AccessTokenPayload,
    batchId: string,
    date: Date,
    eventId: string,
    instructions: ReturnType<typeof computeStockConsumptionInstructions>,
  ): Promise<void> {
    for (const instruction of instructions) {
      const movement = await this.stockMovementsService.recordMovementInTransaction(tx, {
        farmId: actingUser.farmId,
        itemId: instruction.itemId,
        type: instruction.type,
        reason: instruction.reason,
        quantity: instruction.quantity,
        date,
        createdBy: actingUser.sub,
        sourceType: 'layer_health_event',
        sourceId: eventId,
      });
      if (instruction.reason === 'DISTRIBUTION_BANDE') {
        await tx.expense.create({
          data: {
            farmId: actingUser.farmId,
            layerBatchId: batchId,
            date,
            category: 'Santé',
            description: 'Traitement sanitaire (mouvement de stock automatique)',
            quantity: movement.quantity,
            unitPriceFcfa: movement.unitCostFcfaSnapshot,
            amountFcfa: movement.totalValueFcfa,
            createdBy: actingUser.sub,
          },
        });
      }
    }
  }

  async create(
    actingUser: AccessTokenPayload,
    batchId: string,
    dto: CreateHealthEventDto,
    ipAddress: string | null,
  ): Promise<LayerHealthEvent> {
    await this.assertBatchAccessible(actingUser, batchId);
    const date = new Date(dto.date);
    const status: HealthEventStatus = dto.status ?? 'PREVU';
    const instructions =
      status === 'REALISE' && dto.itemId
        ? computeStockConsumptionInstructions(null, 0, dto.itemId, dto.quantityUsed ?? 0)
        : [];

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.layerHealthEvent.create({
        data: {
          farmId: actingUser.farmId,
          batchId,
          date,
          status: dto.status,
          type: dto.type,
          product: dto.product,
          motif: dto.motif,
          dose: dto.dose,
          quantity: dto.quantity,
          unit: dto.unit,
          itemId: dto.itemId,
          quantityUsed: dto.quantityUsed,
          durationDays: dto.durationDays,
          administrationRoute: dto.administrationRoute,
          prescribedBy: dto.prescribedBy,
          performedBy: dto.performedBy,
          costFcfa: dto.costFcfa,
          observation: dto.observation,
          createdBy: actingUser.sub,
        },
      });
      await this.applyHealthStockInstructions(
        tx,
        actingUser,
        batchId,
        date,
        created.id,
        instructions,
      );
      return created;
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

    const nextStatus = dto.status !== undefined ? dto.status : existing.status;
    const nextItemId = dto.itemId !== undefined ? dto.itemId : existing.itemId;
    const nextQuantityUsed =
      dto.quantityUsed !== undefined
        ? dto.quantityUsed
        : existing.quantityUsed
          ? Number(existing.quantityUsed)
          : 0;

    const effectivePreviousItemId = existing.status === 'REALISE' ? existing.itemId : null;
    const effectivePreviousQuantity =
      existing.status === 'REALISE' && existing.quantityUsed ? Number(existing.quantityUsed) : 0;
    const effectiveNextItemId = nextStatus === 'REALISE' ? nextItemId : null;
    const effectiveNextQuantity = nextStatus === 'REALISE' ? nextQuantityUsed : 0;

    const instructions = computeStockConsumptionInstructions(
      effectivePreviousItemId,
      effectivePreviousQuantity,
      effectiveNextItemId,
      effectiveNextQuantity,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const event = await tx.layerHealthEvent.update({
        where: { id },
        data: { ...dto, date: dto.date ? new Date(dto.date) : undefined },
      });
      await this.applyHealthStockInstructions(
        tx,
        actingUser,
        batchId,
        event.date,
        event.id,
        instructions,
      );
      return event;
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
