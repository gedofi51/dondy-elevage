import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Item } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { computeStockStatus, type StockStatus } from './calculations/stock-status.calculations';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';
import type { ListItemsQueryDto } from './dto/list-items.query.dto';

export interface ItemWithComputed extends Item {
  status: StockStatus;
}

/** Catalogue — donnée de référence permanente (comme Building/Incubator),
 * pas de code auto (aucun champ "code article" au §8.1). currentStock/
 * averageUnitCostFcfa sont écrits EXCLUSIVEMENT par
 * StockMovementsService.recordMovementInTransaction — jamais ici. */
@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async assertSupplierBelongsToFarm(farmId: string, supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || supplier.farmId !== farmId) {
      throw new NotFoundException('Fournisseur introuvable.');
    }
  }

  private attachComputed(item: Item): ItemWithComputed {
    return {
      ...item,
      status: computeStockStatus(
        Number(item.currentStock),
        item.minThreshold ? Number(item.minThreshold) : null,
      ),
    };
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateItemDto,
    ipAddress: string | null,
  ): Promise<ItemWithComputed> {
    if (dto.supplierId) {
      await this.assertSupplierBelongsToFarm(actingUser.farmId, dto.supplierId);
    }

    const item = await this.prisma.item.create({
      data: {
        farmId: actingUser.farmId,
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        minThreshold: dto.minThreshold,
        supplierId: dto.supplierId,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'item',
      entityId: item.id,
      action: 'ITEM_CREATED',
      newValues: { name: dto.name, category: dto.category, unit: dto.unit },
      ipAddress,
    });

    return this.attachComputed(item);
  }

  async findAll(
    actingUser: AccessTokenPayload,
    query: ListItemsQueryDto,
  ): Promise<ItemWithComputed[]> {
    const items = await this.prisma.item.findMany({
      where: { farmId: actingUser.farmId, category: query.category },
      orderBy: { name: 'asc' },
    });
    const withComputed = items.map((item) => this.attachComputed(item));
    if (query.belowThreshold) {
      return withComputed.filter((item) => item.status !== 'VERT');
    }
    return withComputed;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<ItemWithComputed> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Article introuvable.');
    }
    assertSameFarm(actingUser, item.farmId);
    return this.attachComputed(item);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateItemDto,
    ipAddress: string | null,
  ): Promise<ItemWithComputed> {
    const existing = await this.findOne(actingUser, id);
    if (dto.supplierId) {
      await this.assertSupplierBelongsToFarm(actingUser.farmId, dto.supplierId);
    }

    const updated = await this.prisma.item.update({ where: { id }, data: dto });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'item',
      entityId: id,
      action: 'ITEM_UPDATED',
      oldValues: {
        name: existing.name,
        category: existing.category,
        minThreshold: existing.minThreshold,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputed(updated);
  }

  /** Suppression définitive — uniquement si aucun mouvement ni aucune
   * ligne de commande n'est lié (garde-fou explicite dès l'origine, comme
   * WaterPointsService.remove() en Phase 6 — pas de 4e occurrence de
   * l'angle mort Building/Incubator/Supplier, voir DETTE_TECHNIQUE.md). */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);

    const [movementCount, orderItemCount] = await Promise.all([
      this.prisma.stockMovement.count({ where: { itemId: id } }),
      this.prisma.purchaseOrderItem.count({ where: { itemId: id } }),
    ]);
    if (movementCount > 0 || orderItemCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer un article avec des mouvements ou des lignes de commande enregistrés.',
      );
    }

    await this.prisma.item.delete({ where: { id } });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'item',
      entityId: id,
      action: 'ITEM_DELETED',
      oldValues: { name: existing.name, category: existing.category },
      ipAddress,
    });
  }
}
