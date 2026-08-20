import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  computeGrossMarginFcfa,
  computeProfitabilityRate,
} from '../broiler-batches/calculations/broiler-finance.calculations';
import type { GetTreasuryPeriodQueryDto } from './dto/get-treasury-period.query.dto';

/** §10.5 : mêmes statuts que BroilerBatchesService/ChickBatchesService/
 * IncubationBatchesService — dupliqué localement, cohérent avec le style
 * déjà en place dans ce codebase (voir LayerBatchesService pour le
 * précédent de variante `{ not: 'ANNULEE' }`). */
const CONFIRMED_SALE_STATUSES: Prisma.SaleWhereInput['status'] = {
  in: ['CONFIRMEE', 'PAYEE', 'PARTIELLEMENT_PAYEE', 'IMPAYEE'],
};

export type TreasuryJournalEntryType = 'ENCAISSEMENT' | 'DECAISSEMENT';
export type TreasuryJournalEntrySource = 'payment' | 'supplier_payment' | 'expense';

export interface TreasuryJournalEntry {
  date: Date;
  type: TreasuryJournalEntryType;
  source: TreasuryJournalEntrySource;
  amountFcfa: number;
  method: string | null;
  reference: string | null;
  description: string | null;
}

export interface TreasuryJournal {
  periodStart: Date;
  periodEnd: Date;
  entries: TreasuryJournalEntry[];
  totalEncaissementsFcfa: number;
  totalDecaissementsFcfa: number;
  netFcfa: number;
}

export interface ReceivableByCustomer {
  customerId: string;
  customerName: string;
  totalSoldFcfa: number;
  totalPaidFcfa: number;
  balanceFcfa: number;
}

export interface PayableBySupplier {
  supplierId: string;
  supplierName: string;
  totalOrderedFcfa: number;
  totalPaidFcfa: number;
  balanceFcfa: number;
}

export interface TreasurySummary {
  periodStart: Date;
  periodEnd: Date;
  revenueFcfa: number;
  totalExpensesFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
  /** Encaissements - décaissements sur la période (pas un solde cumulé
   * depuis l'origine — §8.7 ne demande qu'une lecture par période). */
  netTreasuryFcfa: number;
}

/** §8.7 — lecture agrégée uniquement, aucune table dédiée (voir plan Phase
 * 7, section I) : union de Payment/SupplierPayment/Expense pour le
 * journal, calcul symétrique créances clients / dettes fournisseurs à
 * partir de Sale+Payment et PurchaseOrder+SupplierPayment. */
@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async getJournal(
    actingUser: AccessTokenPayload,
    query: GetTreasuryPeriodQueryDto,
  ): Promise<TreasuryJournal> {
    const periodStart = new Date(query.from);
    const periodEnd = new Date(query.to);
    const dateRange = { gte: periodStart, lte: periodEnd };

    const [payments, supplierPayments, expenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: { farmId: actingUser.farmId, deletedAt: null, date: dateRange },
        include: { sale: { select: { saleNumber: true } } },
      }),
      this.prisma.supplierPayment.findMany({
        where: { farmId: actingUser.farmId, deletedAt: null, date: dateRange },
        include: { purchaseOrder: { select: { code: true } } },
      }),
      this.prisma.expense.findMany({
        where: { farmId: actingUser.farmId, deletedAt: null, date: dateRange },
      }),
    ]);

    const entries: TreasuryJournalEntry[] = [
      ...payments.map((payment) => ({
        date: payment.date,
        type: 'ENCAISSEMENT' as const,
        source: 'payment' as const,
        amountFcfa: payment.amountFcfa,
        method: payment.method,
        reference: payment.sale.saleNumber,
        description: payment.observation,
      })),
      ...supplierPayments.map((payment) => ({
        date: payment.date,
        type: 'DECAISSEMENT' as const,
        source: 'supplier_payment' as const,
        amountFcfa: payment.amountFcfa,
        method: payment.method,
        reference: payment.purchaseOrder.code,
        description: payment.observation,
      })),
      ...expenses.map((expense) => ({
        date: expense.date,
        type: 'DECAISSEMENT' as const,
        source: 'expense' as const,
        amountFcfa: expense.amountFcfa,
        method: null,
        reference: expense.category,
        description: expense.description,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const totalEncaissementsFcfa = payments.reduce((sum, p) => sum + p.amountFcfa, 0);
    const totalDecaissementsFcfa =
      supplierPayments.reduce((sum, p) => sum + p.amountFcfa, 0) +
      expenses.reduce((sum, e) => sum + e.amountFcfa, 0);

    return {
      periodStart,
      periodEnd,
      entries,
      totalEncaissementsFcfa,
      totalDecaissementsFcfa,
      netFcfa: totalEncaissementsFcfa - totalDecaissementsFcfa,
    };
  }

  /** Créances clients : ventes confirmées à un client identifié, non
   * intégralement payées. Une vente comptoir (customerId null, EAU) n'a
   * structurellement aucune notion de dette — exclue par construction. */
  async getReceivables(actingUser: AccessTokenPayload): Promise<ReceivableByCustomer[]> {
    const sales = await this.prisma.sale.findMany({
      where: {
        farmId: actingUser.farmId,
        customerId: { not: null },
        status: CONFIRMED_SALE_STATUSES,
      },
      select: { id: true, customerId: true, netAmountFcfa: true },
    });
    if (sales.length === 0) {
      return [];
    }

    const paidBySaleId = await this.prisma.payment.groupBy({
      by: ['saleId'],
      where: { saleId: { in: sales.map((s) => s.id) }, deletedAt: null },
      _sum: { amountFcfa: true },
    });
    const paidMap = new Map(paidBySaleId.map((p) => [p.saleId, p._sum.amountFcfa ?? 0]));

    const byCustomer = new Map<string, { totalSoldFcfa: number; totalPaidFcfa: number }>();
    for (const sale of sales) {
      const customerId = sale.customerId!;
      const current = byCustomer.get(customerId) ?? { totalSoldFcfa: 0, totalPaidFcfa: 0 };
      current.totalSoldFcfa += sale.netAmountFcfa;
      current.totalPaidFcfa += paidMap.get(sale.id) ?? 0;
      byCustomer.set(customerId, current);
    }

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: [...byCustomer.keys()] } },
      select: { id: true, name: true },
    });
    const customerNames = new Map(customers.map((c) => [c.id, c.name]));

    return [...byCustomer.entries()]
      .map(([customerId, totals]) => ({
        customerId,
        customerName: customerNames.get(customerId) ?? customerId,
        totalSoldFcfa: totals.totalSoldFcfa,
        totalPaidFcfa: totals.totalPaidFcfa,
        balanceFcfa: totals.totalSoldFcfa - totals.totalPaidFcfa,
      }))
      .filter((r) => r.balanceFcfa > 0)
      .sort((a, b) => b.balanceFcfa - a.balanceFcfa);
  }

  /** Dettes fournisseurs : calcul symétrique, ANNULE exclu (aucune dette
   * sur une commande annulée). */
  async getPayables(actingUser: AccessTokenPayload): Promise<PayableBySupplier[]> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { farmId: actingUser.farmId, status: { not: 'ANNULE' } },
      select: { id: true, supplierId: true, totalAmountFcfa: true },
    });
    if (orders.length === 0) {
      return [];
    }

    const paidByOrderId = await this.prisma.supplierPayment.groupBy({
      by: ['purchaseOrderId'],
      where: { purchaseOrderId: { in: orders.map((o) => o.id) }, deletedAt: null },
      _sum: { amountFcfa: true },
    });
    const paidMap = new Map(paidByOrderId.map((p) => [p.purchaseOrderId, p._sum.amountFcfa ?? 0]));

    const bySupplier = new Map<string, { totalOrderedFcfa: number; totalPaidFcfa: number }>();
    for (const order of orders) {
      const current = bySupplier.get(order.supplierId) ?? {
        totalOrderedFcfa: 0,
        totalPaidFcfa: 0,
      };
      current.totalOrderedFcfa += order.totalAmountFcfa;
      current.totalPaidFcfa += paidMap.get(order.id) ?? 0;
      bySupplier.set(order.supplierId, current);
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: [...bySupplier.keys()] } },
      select: { id: true, name: true },
    });
    const supplierNames = new Map(suppliers.map((s) => [s.id, s.name]));

    return [...bySupplier.entries()]
      .map(([supplierId, totals]) => ({
        supplierId,
        supplierName: supplierNames.get(supplierId) ?? supplierId,
        totalOrderedFcfa: totals.totalOrderedFcfa,
        totalPaidFcfa: totals.totalPaidFcfa,
        balanceFcfa: totals.totalOrderedFcfa - totals.totalPaidFcfa,
      }))
      .filter((p) => p.balanceFcfa > 0)
      .sort((a, b) => b.balanceFcfa - a.balanceFcfa);
  }

  /** Vue consolidée ferme (§8.8, dernier point) : CA toutes ventes
   * confirmées confondues (4 productType), charges toutes catégories,
   * marge, trésorerie nette de la période. */
  async getSummary(
    actingUser: AccessTokenPayload,
    query: GetTreasuryPeriodQueryDto,
  ): Promise<TreasurySummary> {
    const periodStart = new Date(query.from);
    const periodEnd = new Date(query.to);
    const dateRange = { gte: periodStart, lte: periodEnd };

    const [sales, expenses, payments, supplierPayments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { farmId: actingUser.farmId, status: CONFIRMED_SALE_STATUSES, date: dateRange },
        select: { netAmountFcfa: true },
      }),
      this.prisma.expense.findMany({
        where: { farmId: actingUser.farmId, deletedAt: null, date: dateRange },
        select: { amountFcfa: true },
      }),
      this.prisma.payment.aggregate({
        where: { farmId: actingUser.farmId, deletedAt: null, date: dateRange },
        _sum: { amountFcfa: true },
      }),
      this.prisma.supplierPayment.aggregate({
        where: { farmId: actingUser.farmId, deletedAt: null, date: dateRange },
        _sum: { amountFcfa: true },
      }),
    ]);

    const revenueFcfa = sales.reduce((sum, s) => sum + s.netAmountFcfa, 0);
    const totalExpensesFcfa = expenses.reduce((sum, e) => sum + e.amountFcfa, 0);
    const grossMarginFcfa = computeGrossMarginFcfa(revenueFcfa, totalExpensesFcfa);
    const netTreasuryFcfa =
      (payments._sum.amountFcfa ?? 0) - (supplierPayments._sum.amountFcfa ?? 0) - totalExpensesFcfa;

    return {
      periodStart,
      periodEnd,
      revenueFcfa,
      totalExpensesFcfa,
      grossMarginFcfa,
      profitabilityRate: computeProfitabilityRate(grossMarginFcfa, totalExpensesFcfa),
      netTreasuryFcfa,
    };
  }
}
