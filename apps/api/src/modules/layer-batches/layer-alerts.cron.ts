import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { safeDivide } from '../../common/calculations/safe-math.util';
import { computeDailyMortalityRate } from '../broiler-batches/calculations/broiler-headcount.calculations';
import { computeLotRemaining } from '../egg-stock/calculations/egg-stock-lot.calculations';
import {
  computeLotAgeDays,
  resolveAgingSeverity,
} from '../egg-stock/calculations/egg-stock-aging.calculations';

const ACTIVE_STATUSES: Prisma.LayerBatchWhereInput['status'] = { notIn: ['CLOTURE', 'ANNULEE'] };
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ROLLING_WINDOW_DAYS = 7;

/** §5.5 : seuils sourcés (voir résumé de mission Phase 4 pour le détail des
 * citations) — reconfigurables par ferme sans déploiement (Setting), non
 * bloquants si affinés plus tard. */
const DEFAULT_MORTALITY_THRESHOLD_PERCENT = 0.1;
const DEFAULT_MORTALITY_CRITICAL_THRESHOLD_PERCENT = 0.5;
const DEFAULT_LAYING_RATE_DROP_THRESHOLD_PERCENT = 5;
/** Pas de source trouvée pour ce seuil précis (contrairement à mortalité et
 * taux de ponte) — paramètre d'ingénierie assumé, signalé comme tel. */
const DEFAULT_FEED_DEVIATION_THRESHOLD_PERCENT = 20;
const DEFAULT_EGG_STOCK_AGING_VIGILANCE_DAYS = 4;
const DEFAULT_EGG_STOCK_AGING_IMPORTANT_DAYS = 7;

const SETTING_KEYS = {
  mortalityThreshold: 'layer.mortality_threshold_percent',
  mortalityCriticalThreshold: 'layer.mortality_critical_threshold_percent',
  layingRateDropThreshold: 'layer.laying_rate_drop_threshold_percent',
  feedDeviationThreshold: 'layer.feed_deviation_threshold_percent',
  eggStockAgingVigilanceDays: 'layer.egg_stock_aging_vigilance_days',
  eggStockAgingImportantDays: 'layer.egg_stock_aging_important_days',
} as const;

/**
 * Cron séparé de BroilerAlertsCronService (décision Phase 4, aucune réserve
 * du Plan agent) : aucun jalon calendaire ne se transpose (pas de J1-J46
 * pour une pondeuse en production continue), les clés de Setting diffèrent,
 * et l'alerte "stock d'œufs vieillissant" n'a aucun équivalent côté Broiler.
 */
@Injectable()
export class LayerAlertsCronService {
  private readonly logger = new Logger(LayerAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui' })
  async runDailySweep(): Promise<void> {
    const batches = await this.prisma.layerBatch.findMany({ where: { status: ACTIVE_STATUSES } });
    for (const batch of batches) {
      try {
        await this.processBatch(batch.id);
      } catch (error) {
        // Un lot en erreur ne doit jamais interrompre le balayage des autres.
        this.logger.error(`Échec du balayage d'alertes pour le lot ${batch.id}`, error);
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

  private async getSettingNumber(farmId: string, key: string, fallback: number): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { farmId_key: { farmId, key } },
    });
    return typeof setting?.value === 'number' ? setting.value : fallback;
  }

  private average(values: number[]): number {
    return safeDivide(
      values.reduce((sum, v) => sum + v, 0),
      values.length,
    );
  }

  private async processBatch(batchId: string): Promise<void> {
    const batch = await this.prisma.layerBatch.findUniqueOrThrow({ where: { id: batchId } });
    const today = new Date();
    const yesterday = new Date(today.getTime() - MS_PER_DAY);

    await this.checkMissingEntry(batch.farmId, batch.id, batch.code, yesterday);
    await this.checkMortality(batch.farmId, batch.id, batch.code, yesterday);
    await this.checkLayingRateDrop(batch.farmId, batch.id, batch.code, today);
    await this.checkFeedDeviation(batch.farmId, batch.id, batch.code, today);
    await this.checkEggStockAging(batch.farmId, batch.id, batch.code, today);
    await this.checkHealthEventsDue(batch.farmId, batch.id, batch.code, today);
  }

  /** Contrairement au cron Broiler (operatorId IS NULL sur une ligne
   * pré-générée), il n'existe aucun placeholder côté pondeuses — l'absence
   * de saisie se détecte par ABSENCE DE LIGNE. */
  private async checkMissingEntry(
    farmId: string,
    batchId: string,
    batchCode: string,
    yesterday: Date,
  ): Promise<void> {
    const record = await this.prisma.layerDailyRecord.findUnique({
      where: { batchId_date: { batchId, date: yesterday } },
    });
    if (record) {
      return;
    }
    const type = `layer_missing_entry_${yesterday.toISOString().slice(0, 10)}`;
    if (await this.alertAlreadyRaised(farmId, type, batchId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: 'VIGILANCE',
      title: `${batchCode} — Aucune journée de ponte saisie pour le ${yesterday.toISOString().slice(0, 10)}`,
      entityType: 'layer_batch',
      entityId: batchId,
    });
  }

  private async checkMortality(
    farmId: string,
    batchId: string,
    batchCode: string,
    yesterday: Date,
  ): Promise<void> {
    const record = await this.prisma.layerDailyRecord.findUnique({
      where: { batchId_date: { batchId, date: yesterday } },
    });
    if (!record) {
      return;
    }

    const dailyRate = computeDailyMortalityRate(record.mortalityQuantity, record.henCount);
    const threshold = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.mortalityThreshold,
      DEFAULT_MORTALITY_THRESHOLD_PERCENT,
    );
    if (dailyRate <= threshold) {
      return;
    }

    const criticalThreshold = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.mortalityCriticalThreshold,
      DEFAULT_MORTALITY_CRITICAL_THRESHOLD_PERCENT,
    );
    const dateStr = yesterday.toISOString().slice(0, 10);
    const type = `layer_high_mortality_${dateStr}`;
    if (await this.alertAlreadyRaised(farmId, type, batchId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: dailyRate >= criticalThreshold ? 'CRITIQUE' : 'IMPORTANT',
      title: `${batchCode} — Mortalité élevée le ${dateStr} (${dailyRate.toFixed(2)} %)`,
      entityType: 'layer_batch',
      entityId: batchId,
    });
  }

  /** §5.5 : chute vs moyenne glissante — compare la semaine écoulée à la
   * semaine précédente (pas à une moyenne depuis le début du lot, qui
   * déclencherait une alerte permanente en fin de cycle vu le déclin
   * naturel en approche de réforme). */
  private async checkLayingRateDrop(
    farmId: string,
    batchId: string,
    batchCode: string,
    today: Date,
  ): Promise<void> {
    const twoWindowsAgo = new Date(today.getTime() - 2 * ROLLING_WINDOW_DAYS * MS_PER_DAY);
    const records = await this.prisma.layerDailyRecord.findMany({
      where: { batchId, date: { gte: twoWindowsAgo, lt: today } },
      orderBy: { date: 'asc' },
    });
    if (records.length < 2 * ROLLING_WINDOW_DAYS) {
      // Pas assez d'historique pour comparer deux fenêtres complètes.
      return;
    }

    const previousWeek = records.slice(0, ROLLING_WINDOW_DAYS);
    const recentWeek = records.slice(ROLLING_WINDOW_DAYS);
    const previousAvg = this.average(previousWeek.map((r) => Number(r.layingRatePercent ?? 0)));
    const recentAvg = this.average(recentWeek.map((r) => Number(r.layingRatePercent ?? 0)));

    const dropPercent = safeDivide(previousAvg - recentAvg, previousAvg) * 100;
    const threshold = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.layingRateDropThreshold,
      DEFAULT_LAYING_RATE_DROP_THRESHOLD_PERCENT,
    );
    if (dropPercent < threshold) {
      return;
    }

    const dateStr = today.toISOString().slice(0, 10);
    const type = `layer_laying_rate_drop_${dateStr}`;
    if (await this.alertAlreadyRaised(farmId, type, batchId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: dropPercent >= threshold * 2 ? 'CRITIQUE' : 'IMPORTANT',
      title: `${batchCode} — Chute du taux de ponte (${dropPercent.toFixed(1)} % vs semaine précédente)`,
      entityType: 'layer_batch',
      entityId: batchId,
    });
  }

  private async checkFeedDeviation(
    farmId: string,
    batchId: string,
    batchCode: string,
    today: Date,
  ): Promise<void> {
    const twoWindowsAgo = new Date(today.getTime() - 2 * ROLLING_WINDOW_DAYS * MS_PER_DAY);
    const records = await this.prisma.layerDailyRecord.findMany({
      where: { batchId, date: { gte: twoWindowsAgo, lt: today } },
      orderBy: { date: 'asc' },
    });
    if (records.length < 2 * ROLLING_WINDOW_DAYS) {
      return;
    }

    const previousWeek = records.slice(0, ROLLING_WINDOW_DAYS);
    const recentWeek = records.slice(ROLLING_WINDOW_DAYS);
    const previousAvg = this.average(previousWeek.map((r) => Number(r.feedDistributedKg ?? 0)));
    const recentAvg = this.average(recentWeek.map((r) => Number(r.feedDistributedKg ?? 0)));

    const deviationPercent = safeDivide(Math.abs(recentAvg - previousAvg), previousAvg) * 100;
    const threshold = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.feedDeviationThreshold,
      DEFAULT_FEED_DEVIATION_THRESHOLD_PERCENT,
    );
    if (deviationPercent < threshold) {
      return;
    }

    const dateStr = today.toISOString().slice(0, 10);
    const type = `layer_feed_deviation_${dateStr}`;
    if (await this.alertAlreadyRaised(farmId, type, batchId)) {
      return;
    }
    const direction = recentAvg > previousAvg ? 'élevée' : 'basse';
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: 'IMPORTANT',
      title: `${batchCode} — Consommation d'aliment anormalement ${direction} (écart ${deviationPercent.toFixed(1)} %)`,
      entityType: 'layer_batch',
      entityId: batchId,
    });
  }

  private async checkEggStockAging(
    farmId: string,
    batchId: string,
    batchCode: string,
    today: Date,
  ): Promise<void> {
    const lots = await this.prisma.eggStockLot.findMany({
      where: { batchId },
      include: { movements: true },
    });
    const vigilanceDays = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.eggStockAgingVigilanceDays,
      DEFAULT_EGG_STOCK_AGING_VIGILANCE_DAYS,
    );
    const importantDays = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.eggStockAgingImportantDays,
      DEFAULT_EGG_STOCK_AGING_IMPORTANT_DAYS,
    );

    for (const lot of lots) {
      const remaining = computeLotRemaining(lot.quantityProduced, lot.movements);
      if (remaining <= 0) {
        continue;
      }
      const ageDays = computeLotAgeDays(lot.productionDate, today);
      const severity = resolveAgingSeverity(ageDays, vigilanceDays, importantDays);
      if (severity === 'NONE') {
        continue;
      }

      const type = 'egg_stock_aging_lot';
      if (await this.alertAlreadyRaised(farmId, type, lot.id)) {
        continue;
      }
      await this.alertsService.createSystemAlert(farmId, {
        type,
        severity,
        title: `${batchCode} — Stock d'œufs vieillissant (lot du ${lot.productionDate.toISOString().slice(0, 10)}, ${ageDays} j, ${remaining} restants)`,
        entityType: 'egg_stock_lot',
        entityId: lot.id,
      });
    }
  }

  private async checkHealthEventsDue(
    farmId: string,
    batchId: string,
    batchCode: string,
    today: Date,
  ): Promise<void> {
    const dueEvents = await this.prisma.layerHealthEvent.findMany({
      where: { batchId, status: 'PREVU', date: { lte: today } },
    });
    for (const event of dueEvents) {
      const type = 'layer_health_event_due';
      if (await this.alertAlreadyRaised(farmId, type, event.id)) {
        continue;
      }
      await this.alertsService.createSystemAlert(farmId, {
        type,
        severity: 'IMPORTANT',
        title: `${batchCode} — ${event.type} à échéance (${event.date.toISOString().slice(0, 10)})`,
        entityType: 'layer_health_event',
        entityId: event.id,
      });
    }
  }
}
