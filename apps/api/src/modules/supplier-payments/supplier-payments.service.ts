import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PurchaseOrder, SupplierPayment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import type { ListSupplierPaymentsQueryDto } from './dto/list-supplier-payments.query.dto';

/** Entité SÉPARÉE de Payment (voir plan Phase 7, section G) — pas de
 * statut de commande dérivé du paiement (contrairement à Sale.status) :
 * PurchaseOrderStatus reste exclusivement piloté par les réceptions
 * (GoodsReceiptsService), le solde restant est un champ calculé à la
 * lecture (PurchaseOrdersService.attachComputed), pas un driver de statut. */
@Injectable()
export class SupplierPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async getPurchaseOrder(farmId: string, purchaseOrderId: string): Promise<PurchaseOrder> {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!order || order.farmId !== farmId) {
      throw new NotFoundException('Commande introuvable.');
    }
    return order;
  }

  /** §15 : "un paiement ne peut pas excéder le solde restant sans règle
   * explicite d'avoir" — implémenté dès la création (voir aussi le même
   * correctif appliqué à PaymentsService cette même phase,
   * DETTE_TECHNIQUE.md : ce contrôle manquait sur Payment). */
  async create(
    actingUser: AccessTokenPayload,
    dto: CreateSupplierPaymentDto,
    ipAddress: string | null,
  ): Promise<SupplierPayment> {
    const order = await this.getPurchaseOrder(actingUser.farmId, dto.purchaseOrderId);

    const paidAgg = await this.prisma.supplierPayment.aggregate({
      where: { purchaseOrderId: dto.purchaseOrderId, deletedAt: null },
      _sum: { amountFcfa: true },
    });
    const alreadyPaidFcfa = paidAgg._sum.amountFcfa ?? 0;
    if (alreadyPaidFcfa + dto.amountFcfa > order.totalAmountFcfa) {
      throw new ConflictException(
        `Paiement (${dto.amountFcfa} FCFA) supérieur au solde restant (${order.totalAmountFcfa - alreadyPaidFcfa} FCFA).`,
      );
    }

    const payment = await this.prisma.supplierPayment.create({
      data: {
        farmId: actingUser.farmId,
        purchaseOrderId: dto.purchaseOrderId,
        date: new Date(dto.date),
        method: dto.method,
        amountFcfa: dto.amountFcfa,
        reference: dto.reference,
        observation: dto.observation,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'supplier_payment',
      entityId: payment.id,
      action: 'SUPPLIER_PAYMENT_CREATED',
      newValues: {
        purchaseOrderId: dto.purchaseOrderId,
        method: dto.method,
        amountFcfa: dto.amountFcfa,
      },
      ipAddress,
    });

    return payment;
  }

  async findAll(
    actingUser: AccessTokenPayload,
    query: ListSupplierPaymentsQueryDto,
  ): Promise<SupplierPayment[]> {
    return this.prisma.supplierPayment.findMany({
      where: {
        farmId: actingUser.farmId,
        deletedAt: null,
        purchaseOrderId: query.purchaseOrderId,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<SupplierPayment> {
    const payment = await this.prisma.supplierPayment.findUnique({ where: { id } });
    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Paiement introuvable.');
    }
    assertSameFarm(actingUser, payment.farmId);
    return payment;
  }

  /** Append-only : correction via suppression (soft) + recréation, jamais
   * d'édition en place — donnée financière, pas de suppression définitive
   * (même pattern que PaymentsService.remove()). */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);

    await this.prisma.supplierPayment.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'supplier_payment',
      entityId: id,
      action: 'SUPPLIER_PAYMENT_DELETED',
      oldValues: { amountFcfa: existing.amountFcfa, method: existing.method },
      ipAddress,
    });
  }
}
