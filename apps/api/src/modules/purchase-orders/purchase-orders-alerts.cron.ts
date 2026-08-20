import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PurchaseOrder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

/**
 * Phase 8 — durcissement (bilan V1-V5 : aucune alerte financière n'existait
 * malgré §10 "Alertes financières : facture impayée, dépense inhabituelle").
 * Seule instance retenue cette phase : facture fournisseur en retard de
 * paiement (réutilise PurchaseOrder.dueDate déjà existant). "Dépense
 * inhabituelle" (détection d'anomalie statistique) explicitement exclue —
 * aucune définition dans le cahier, périmètre V6/IA (détection d'anomalies).
 * Alerte d'ÉTAT (pas de suffixe date), même principe d'idempotence que les
 * autres crons du projet.
 */
@Injectable()
export class PurchaseOrdersAlertsCronService {
  private readonly logger = new Logger(PurchaseOrdersAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui' })
  async runDailySweep(): Promise<void> {
    const overdueOrders = await this.prisma.purchaseOrder.findMany({
      where: { status: { not: 'ANNULE' }, dueDate: { lt: new Date() } },
    });
    for (const order of overdueOrders) {
      try {
        await this.processOrder(order);
      } catch (error) {
        // Une commande en erreur ne doit jamais interrompre le balayage des autres.
        this.logger.error(`Échec du balayage d'alertes pour la commande ${order.id}`, error);
      }
    }
  }

  private async alertAlreadyRaised(
    farmId: string,
    type: string,
    entityId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.alert.findFirst({
      where: { farmId, type, entityId },
      select: { id: true },
    });
    return existing !== null;
  }

  private async processOrder(order: PurchaseOrder): Promise<void> {
    const paidAgg = await this.prisma.supplierPayment.aggregate({
      where: { purchaseOrderId: order.id, deletedAt: null },
      _sum: { amountFcfa: true },
    });
    const balanceFcfa = order.totalAmountFcfa - (paidAgg._sum.amountFcfa ?? 0);
    if (balanceFcfa <= 0) {
      return;
    }

    const type = 'purchase_order_overdue';
    if (await this.alertAlreadyRaised(order.farmId, type, order.id)) {
      return;
    }

    await this.alertsService.createSystemAlert(order.farmId, {
      type,
      severity: 'IMPORTANT',
      title: `${order.code} — Facture fournisseur en retard de paiement (solde ${balanceFcfa} FCFA)`,
      entityType: 'purchase_order',
      entityId: order.id,
    });
  }
}
