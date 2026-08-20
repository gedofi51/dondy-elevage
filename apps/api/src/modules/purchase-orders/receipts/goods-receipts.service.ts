import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GoodsReceipt, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { StockMovementsService } from '../../stock-movements/stock-movements.service';
import type { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  async findAll(actingUser: AccessTokenPayload, purchaseOrderId: string): Promise<GoodsReceipt[]> {
    await this.assertPurchaseOrderAccessible(actingUser, purchaseOrderId);
    return this.prisma.goodsReceipt.findMany({
      where: { purchaseOrderId },
      orderBy: { date: 'asc' },
    });
  }

  private async assertPurchaseOrderAccessible(
    actingUser: AccessTokenPayload,
    purchaseOrderId: string,
  ) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }
    assertSameFarm(actingUser, order.farmId);
    return order;
  }

  /**
   * Chaque GoodsReceiptItem avec receivedQuantity > 0 déclenche un
   * StockMovement ENTREE (reason=ACHAT) via StockMovementsService — verrou
   * SELECT ... FOR UPDATE par article. Plusieurs articles traités dans
   * CETTE MÊME transaction : verrouillage trié par itemId (ordre
   * déterministe) pour éviter un deadlock InnoDB entre deux réceptions
   * concurrentes listant les mêmes articles dans un ordre différent (voir
   * plan Phase 7, section C).
   */
  async create(
    actingUser: AccessTokenPayload,
    purchaseOrderId: string,
    dto: CreateGoodsReceiptDto,
    ipAddress: string | null,
  ): Promise<GoodsReceipt> {
    const order = await this.assertPurchaseOrderAccessible(actingUser, purchaseOrderId);
    if (order.status === 'ANNULE' || order.status === 'RECU') {
      throw new ConflictException(
        `Impossible d'enregistrer une réception sur une commande au statut ${order.status}.`,
      );
    }

    const purchaseOrderItems = await this.prisma.purchaseOrderItem.findMany({
      where: { id: { in: dto.items.map((line) => line.purchaseOrderItemId) } },
    });
    const byId = new Map(purchaseOrderItems.map((line) => [line.id, line]));
    const missing = dto.items.filter((line) => !byId.has(line.purchaseOrderItemId));
    if (missing.length > 0) {
      throw new BadRequestException('Une ou plusieurs lignes de commande sont introuvables.');
    }
    const foreignLine = purchaseOrderItems.find((line) => line.purchaseOrderId !== purchaseOrderId);
    if (foreignLine) {
      throw new BadRequestException('Une ligne ne correspond pas à cette commande.');
    }

    // Ordre déterministe par itemId — voir docstring.
    const sortedLines = [...dto.items].sort((a, b) => {
      const itemA = byId.get(a.purchaseOrderItemId)!.itemId;
      const itemB = byId.get(b.purchaseOrderItemId)!.itemId;
      return itemA.localeCompare(itemB);
    });

    const date = new Date(dto.date);
    const responsibleId = dto.responsibleId ?? actingUser.sub;

    const receipt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.goodsReceipt.create({
        data: {
          farmId: actingUser.farmId,
          purchaseOrderId,
          date,
          responsibleId,
          observation: dto.observation,
          createdBy: actingUser.sub,
        },
      });

      for (const line of sortedLines) {
        const orderLine = byId.get(line.purchaseOrderItemId)!;
        await tx.goodsReceiptItem.create({
          data: {
            farmId: actingUser.farmId,
            goodsReceiptId: created.id,
            purchaseOrderItemId: line.purchaseOrderItemId,
            receivedQuantity: line.receivedQuantity,
          },
        });
        await this.stockMovementsService.recordMovementInTransaction(tx, {
          farmId: actingUser.farmId,
          itemId: orderLine.itemId,
          type: 'ENTREE',
          reason: 'ACHAT',
          quantity: line.receivedQuantity,
          date,
          createdBy: actingUser.sub,
          unitCostFcfa: orderLine.unitPriceFcfa,
          sourceType: 'goods_receipt',
          sourceId: created.id,
        });
      }

      // Statut dérivé : RECU si toutes les lignes sont intégralement
      // reçues (cumul toutes réceptions confondues), PARTIELLEMENT_RECU
      // si au moins une réception existe sans que tout soit complet.
      const allLines = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId },
        include: { goodsReceiptItems: true },
      });
      const allFullyReceived = allLines.every((purchaseOrderLine) => {
        const received = purchaseOrderLine.goodsReceiptItems.reduce(
          (sum, receiptItem) => sum + Number(receiptItem.receivedQuantity),
          0,
        );
        return received >= Number(purchaseOrderLine.orderedQuantity);
      });
      const newStatus: PurchaseOrderStatus = allFullyReceived ? 'RECU' : 'PARTIELLEMENT_RECU';
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: newStatus },
      });

      return created;
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'goods_receipt',
      entityId: receipt.id,
      action: 'GOODS_RECEIPT_CREATED',
      newValues: { purchaseOrderId, lines: dto.items.length },
      ipAddress,
    });

    return receipt;
  }
}
