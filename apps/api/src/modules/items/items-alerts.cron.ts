import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Item } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { computeStockStatus } from './calculations/stock-status.calculations';

/**
 * Phase 8 — durcissement (bilan V1-V5 : aucune alerte stock n'existait
 * malgré §10 "Alertes de stock : seuil minimum, rupture", contrairement à
 * tous les autres modules métier qui ont chacun leur cron dédié). Alerte
 * d'ÉTAT (pas de suffixe date, comme incubation_low_hatch_rate) : une
 * seule fois par article tant que le statut ne redescend pas sous le
 * seuil ET qu'aucune nouvelle alerte n'a déjà été levée pour ce statut —
 * même principe d'idempotence que WaterAlertsCronService.
 */
@Injectable()
export class ItemsAlertsCronService {
  private readonly logger = new Logger(ItemsAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui', unrefTimeout: true })
  async runDailySweep(): Promise<void> {
    const items = await this.prisma.item.findMany();
    for (const item of items) {
      try {
        await this.processItem(item);
      } catch (error) {
        // Un article en erreur ne doit jamais interrompre le balayage des autres.
        this.logger.error(`Échec du balayage d'alertes pour l'article ${item.id}`, error);
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

  private async processItem(item: Item): Promise<void> {
    const status = computeStockStatus(
      Number(item.currentStock),
      item.minThreshold ? Number(item.minThreshold) : null,
    );
    if (status === 'VERT') {
      return;
    }

    const type = status === 'ROUGE' ? 'item_stock_rouge' : 'item_stock_orange';
    if (await this.alertAlreadyRaised(item.farmId, type, item.id)) {
      return;
    }

    await this.alertsService.createSystemAlert(item.farmId, {
      type,
      severity: status === 'ROUGE' ? 'CRITIQUE' : 'VIGILANCE',
      title:
        status === 'ROUGE'
          ? `${item.name} — Rupture de stock`
          : `${item.name} — Stock sous le seuil minimum`,
      entityType: 'item',
      entityId: item.id,
    });
  }
}
