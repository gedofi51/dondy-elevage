import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PurchaseOrder, type PurchaseOrderItem } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { computeReceiptDiscrepancy } from './calculations/receipt-discrepancy.calculations';
import type { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import type { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

const CODE_PREFIX_BASE = 'ACH';
const CODE_DIGITS = 3;
const MAX_CODE_RETRIES = 3;

export interface PurchaseOrderItemWithComputed extends PurchaseOrderItem {
  receivedQuantity: number;
  discrepancy: number;
}

export interface PurchaseOrderWithComputed extends PurchaseOrder {
  items: PurchaseOrderItemWithComputed[];
  paidAmountFcfa: number;
  balanceFcfa: number;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async generateCode(farmId: string, year: number): Promise<string> {
    const prefix = `${CODE_PREFIX_BASE}-${year}-`;
    const last = await this.prisma.purchaseOrder.findFirst({
      where: { farmId, code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  private async assertSupplierBelongsToFarm(farmId: string, supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || supplier.farmId !== farmId) {
      throw new NotFoundException('Fournisseur introuvable.');
    }
  }

  private async assertItemsBelongToFarm(farmId: string, itemIds: string[]): Promise<void> {
    const items = await this.prisma.item.findMany({ where: { id: { in: itemIds } } });
    const foundIds = new Set(items.filter((i) => i.farmId === farmId).map((i) => i.id));
    const missing = itemIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException('Un ou plusieurs articles sont introuvables.');
    }
  }

  private async attachComputed(order: PurchaseOrder): Promise<PurchaseOrderWithComputed> {
    const [items, receiptItems, paidAgg] = await Promise.all([
      this.prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: order.id } }),
      this.prisma.goodsReceiptItem.findMany({
        where: { purchaseOrderItem: { purchaseOrderId: order.id } },
      }),
      this.prisma.supplierPayment.aggregate({
        where: { purchaseOrderId: order.id, deletedAt: null },
        _sum: { amountFcfa: true },
      }),
    ]);
    const receivedByLine = new Map<string, number>();
    for (const receiptItem of receiptItems) {
      receivedByLine.set(
        receiptItem.purchaseOrderItemId,
        (receivedByLine.get(receiptItem.purchaseOrderItemId) ?? 0) +
          Number(receiptItem.receivedQuantity),
      );
    }
    const itemsWithComputed: PurchaseOrderItemWithComputed[] = items.map((item) => {
      const receivedQuantity = receivedByLine.get(item.id) ?? 0;
      return {
        ...item,
        receivedQuantity,
        discrepancy: computeReceiptDiscrepancy(Number(item.orderedQuantity), receivedQuantity),
      };
    });
    const paidAmountFcfa = paidAgg._sum.amountFcfa ?? 0;

    return {
      ...order,
      items: itemsWithComputed,
      paidAmountFcfa,
      balanceFcfa: order.totalAmountFcfa - paidAmountFcfa,
    };
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreatePurchaseOrderDto,
    ipAddress: string | null,
  ): Promise<PurchaseOrderWithComputed> {
    await this.assertSupplierBelongsToFarm(actingUser.farmId, dto.supplierId);
    await this.assertItemsBelongToFarm(
      actingUser.farmId,
      dto.items.map((i) => i.itemId),
    );

    const date = new Date(dto.date);
    const lines = dto.items.map((line) => ({
      itemId: line.itemId,
      orderedQuantity: line.orderedQuantity,
      unitPriceFcfa: line.unitPriceFcfa,
      lineAmountFcfa: Math.round(line.orderedQuantity * line.unitPriceFcfa),
    }));
    const totalAmountFcfa = lines.reduce((sum, line) => sum + line.lineAmountFcfa, 0);

    let order: PurchaseOrder | undefined;
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateCode(actingUser.farmId, date.getFullYear());
      try {
        order = await this.prisma.$transaction(async (tx) => {
          const created = await tx.purchaseOrder.create({
            data: {
              farmId: actingUser.farmId,
              code,
              supplierId: dto.supplierId,
              date,
              dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
              totalAmountFcfa,
              observation: dto.observation,
              createdBy: actingUser.sub,
            },
          });
          await tx.purchaseOrderItem.createMany({
            data: lines.map((line) => ({
              farmId: actingUser.farmId,
              purchaseOrderId: created.id,
              ...line,
            })),
          });
          return created;
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }
    if (!order) {
      throw new ConflictException('Impossible de générer un code de commande unique — réessayer.');
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'purchase_order',
      entityId: order.id,
      action: 'PURCHASE_ORDER_CREATED',
      newValues: { code: order.code, supplierId: dto.supplierId, totalAmountFcfa },
      ipAddress,
    });

    return this.attachComputed(order);
  }

  async findAll(actingUser: AccessTokenPayload): Promise<PurchaseOrderWithComputed[]> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(orders.map((order) => this.attachComputed(order)));
  }

  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<PurchaseOrder> {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }
    assertSameFarm(actingUser, order.farmId);
    return order;
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<PurchaseOrderWithComputed> {
    const order = await this.getRaw(actingUser, id);
    return this.attachComputed(order);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdatePurchaseOrderDto,
    ipAddress: string | null,
  ): Promise<PurchaseOrderWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    if (dto.status && dto.status !== 'COMMANDE') {
      throw new BadRequestException(
        "Seule la transition vers COMMANDE est autorisée ici — PARTIELLEMENT_RECU/RECU sont dérivés automatiquement des réceptions, ANNULE passe par l'endpoint dédié.",
      );
    }
    if (dto.status === 'COMMANDE' && existing.status !== 'BROUILLON') {
      throw new ConflictException(
        `Impossible de passer en COMMANDE depuis le statut ${existing.status}.`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        observation: dto.observation,
        status: dto.status,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'purchase_order',
      entityId: id,
      action: 'PURCHASE_ORDER_UPDATED',
      oldValues: { status: existing.status, dueDate: existing.dueDate },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputed(updated);
  }

  /** Bloquée dès qu'une réception existe — annuler une commande déjà
   * (partiellement) honorée laisserait un stock entré sans commande
   * valide en face (même raisonnement que Payment/Sale : pas d'annulation
   * silencieuse d'une écriture déjà engagée). */
  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<PurchaseOrderWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    const receiptCount = await this.prisma.goodsReceipt.count({ where: { purchaseOrderId: id } });
    if (receiptCount > 0) {
      throw new ConflictException(
        'Impossible d’annuler une commande déjà (partiellement) réceptionnée.',
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'ANNULE' },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'purchase_order',
      entityId: id,
      action: 'PURCHASE_ORDER_CANCELLED',
      oldValues: { status: existing.status },
      newValues: { status: 'ANNULE' },
      ipAddress,
    });

    return this.attachComputed(updated);
  }
}
