import { Injectable, NotFoundException } from '@nestjs/common';
import type { Payment, Sale } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { computeSaleStatus } from '../broiler-batches/calculations/broiler-sales.calculations';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { ListPaymentsQueryDto } from './dto/list-payments.query.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async getSale(farmId: string, saleId: string): Promise<Sale> {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale || sale.farmId !== farmId) {
      throw new NotFoundException('Vente introuvable.');
    }
    return sale;
  }

  /** Recalcule et persiste le statut de la vente après ajout/suppression
   * d'un paiement — voir computeSaleStatus (BROUILLON/RESERVEE/ANNULEE ne
   * sont jamais modifiés par un paiement). */
  private async recomputeSaleStatus(sale: Sale): Promise<void> {
    const paidAgg = await this.prisma.payment.aggregate({
      where: { saleId: sale.id, deletedAt: null },
      _sum: { amountFcfa: true },
    });
    const cumulativePaidFcfa = paidAgg._sum.amountFcfa ?? 0;
    const newStatus = computeSaleStatus(sale.netAmountFcfa, cumulativePaidFcfa, sale.status);
    if (newStatus !== sale.status) {
      await this.prisma.sale.update({ where: { id: sale.id }, data: { status: newStatus } });
    }
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreatePaymentDto,
    ipAddress: string | null,
  ): Promise<Payment> {
    const sale = await this.getSale(actingUser.farmId, dto.saleId);

    const payment = await this.prisma.payment.create({
      data: {
        farmId: actingUser.farmId,
        saleId: dto.saleId,
        date: new Date(dto.date),
        method: dto.method,
        amountFcfa: dto.amountFcfa,
        reference: dto.reference,
        observation: dto.observation,
        createdBy: actingUser.sub,
      },
    });

    await this.recomputeSaleStatus(sale);

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'payment',
      entityId: payment.id,
      action: 'PAYMENT_CREATED',
      newValues: { saleId: dto.saleId, method: dto.method, amountFcfa: dto.amountFcfa },
      ipAddress,
    });

    return payment;
  }

  async findAll(actingUser: AccessTokenPayload, query: ListPaymentsQueryDto): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { farmId: actingUser.farmId, deletedAt: null, saleId: query.saleId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Paiement introuvable.');
    }
    assertSameFarm(actingUser, payment.farmId);
    return payment;
  }

  /** Append-only : correction via suppression (soft) + recréation, jamais
   * d'édition en place — donnée financière, pas de suppression définitive. */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);
    const sale = await this.getSale(actingUser.farmId, existing.saleId);

    await this.prisma.payment.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.recomputeSaleStatus(sale);

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'payment',
      entityId: id,
      action: 'PAYMENT_DELETED',
      oldValues: { amountFcfa: existing.amountFcfa, method: existing.method },
      ipAddress,
    });
  }
}
