import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { computeDayNumber } from '../broiler-batches/calculations/broiler-calendar';
import { computeStartedQuantity } from '../broiler-batches/calculations/broiler-headcount.calculations';
import {
  detectBroilerCrossSignalAnomaly,
  type BroilerDailyRecordLike,
} from './calculations/broiler-anomaly.calculations';
import { detectLayerCrossSignalAnomaly } from './calculations/layer-anomaly.calculations';
import { formatAnomalyDecomposition } from './calculations/anomaly-message.calculations';

const BROILER_ACTIVE_STATUSES: Prisma.BroilerBatchWhereInput['status'] = {
  notIn: ['CLOTUREE', 'ANNULEE'],
};
const LAYER_ACTIVE_STATUSES: Prisma.LayerBatchWhereInput['status'] = {
  notIn: ['CLOTURE', 'ANNULEE'],
};

const BROILER_RULE_DESCRIPTION =
  'baisse eau ET baisse aliment ET hausse mortalité simultanées sur une fenêtre glissante';
const LAYER_RULE_DESCRIPTION =
  'baisse aliment ET hausse mortalité simultanées sur une fenêtre glissante';
/** Hausse mortalité au-delà de 2x le seuil -> CRITIQUE, sinon IMPORTANT —
 * même principe que BroilerAlertsCronService.checkPreviousDayIssues.
 * `changePercent = Infinity` (apparition sans référence, voir
 * anomaly-signal.calculations.ts) est toujours >= le seuil doublé ->
 * CRITIQUE d'office, cohérent : c'est le signal le plus parlant. */
const CRITICAL_MORTALITY_MULTIPLIER = 2;

function resolveSeverity(
  mortalityChangePercent: number,
  mortalityThresholdPercent: number,
): 'IMPORTANT' | 'CRITIQUE' {
  return mortalityChangePercent >= mortalityThresholdPercent * CRITICAL_MORTALITY_MULTIPLIER
    ? 'CRITIQUE'
    : 'IMPORTANT';
}

/**
 * Détection d'anomalies (Lot 4) — moteur de règles croisées branché sur le
 * moteur d'alertes générique existant (AlertsService.createSystemAlert),
 * même patron que BroilerAlertsCronService/LayerAlertsCronService (Phase
 * 3/12) : un cron quotidien, idempotence applicative (type+entityId),
 * aucune table ni mécanisme parallèle. Différence avec les alertes
 * existantes : celles-ci vérifient un seuil ISOLÉ sur un seul jour ; ce
 * cron croise plusieurs signaux sur une fenêtre de plusieurs jours (voir
 * calculations/broiler-anomaly.calculations.ts).
 */
@Injectable()
export class AnomalyDetectionCronService {
  private readonly logger = new Logger(AnomalyDetectionCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui' })
  async runDailySweep(): Promise<void> {
    await this.sweepBroilerBatches();
    await this.sweepLayerBatches();
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

  private async sweepBroilerBatches(): Promise<void> {
    const batches = await this.prisma.broilerBatch.findMany({
      where: { status: BROILER_ACTIVE_STATUSES },
    });
    for (const batch of batches) {
      try {
        await this.processBroilerBatch(batch);
      } catch (error) {
        this.logger.error(`Échec de la détection d'anomalies pour la bande ${batch.id}`, error);
      }
    }
  }

  private async processBroilerBatch(batch: {
    id: string;
    farmId: string;
    code: string;
    arrivalDate: Date;
    receivedQuantity: number;
    deadOnArrivalQuantity: number;
  }): Promise<void> {
    const dayNumber = computeDayNumber(batch.arrivalDate, new Date());
    const previousDay = dayNumber - 1;
    const type = `anomalie_croisee_broiler_j${previousDay}`;
    if (previousDay < 1 || (await this.alertAlreadyRaised(batch.farmId, type, batch.id))) {
      return;
    }

    const records = await this.prisma.broilerDailyRecord.findMany({
      where: { batchId: batch.id },
      select: {
        dayNumber: true,
        operatorId: true,
        mortalityQuantity: true,
        feedDistributedKg: true,
        waterConsumptionLiters: true,
      },
    });
    const startedQuantity = computeStartedQuantity(
      batch.receivedQuantity,
      batch.deadOnArrivalQuantity,
    );
    const result = detectBroilerCrossSignalAnomaly(
      records.map((r): BroilerDailyRecordLike => ({
        dayNumber: r.dayNumber,
        operatorId: r.operatorId,
        mortalityQuantity: r.mortalityQuantity,
        feedDistributedKg: r.feedDistributedKg ? Number(r.feedDistributedKg) : null,
        waterConsumptionLiters: r.waterConsumptionLiters ? Number(r.waterConsumptionLiters) : null,
      })),
      dayNumber,
      startedQuantity,
    );

    if (!result.triggered || !result.water || !result.feed || !result.mortality) {
      return;
    }

    const message = formatAnomalyDecomposition(
      [result.water, result.feed, result.mortality],
      BROILER_RULE_DESCRIPTION,
    );
    await this.alertsService.createSystemAlert(batch.farmId, {
      type,
      severity: resolveSeverity(result.mortality.changePercent, result.mortality.thresholdPercent),
      title: `${batch.code} — Anomalie multi-signaux détectée (J${result.recentDayRange![0]}-J${result.recentDayRange![1]})`,
      message,
      entityType: 'broiler_batch',
      entityId: batch.id,
    });
  }

  private async sweepLayerBatches(): Promise<void> {
    const batches = await this.prisma.layerBatch.findMany({
      where: { status: LAYER_ACTIVE_STATUSES },
    });
    for (const batch of batches) {
      try {
        await this.processLayerBatch(batch);
      } catch (error) {
        this.logger.error(`Échec de la détection d'anomalies pour le lot ${batch.id}`, error);
      }
    }
  }

  private async processLayerBatch(batch: {
    id: string;
    farmId: string;
    code: string;
  }): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const type = `anomalie_croisee_layer_${today}`;
    if (await this.alertAlreadyRaised(batch.farmId, type, batch.id)) {
      return;
    }

    // date < aujourd'hui : le jour courant peut légitimement ne pas encore
    // être saisi, même précaution que côté Broiler.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const records = await this.prisma.layerDailyRecord.findMany({
      where: { batchId: batch.id, date: { lt: startOfToday } },
      orderBy: { date: 'desc' },
      select: { date: true, henCount: true, mortalityQuantity: true, feedDistributedKg: true },
    });
    const result = detectLayerCrossSignalAnomaly(
      records.map((r) => ({
        date: r.date,
        henCount: r.henCount,
        mortalityQuantity: r.mortalityQuantity,
        feedDistributedKg: r.feedDistributedKg ? Number(r.feedDistributedKg) : null,
      })),
    );

    if (!result.triggered || !result.feed || !result.mortality) {
      return;
    }

    const message = formatAnomalyDecomposition(
      [result.feed, result.mortality],
      LAYER_RULE_DESCRIPTION,
    );
    await this.alertsService.createSystemAlert(batch.farmId, {
      type,
      severity: resolveSeverity(result.mortality.changePercent, result.mortality.thresholdPercent),
      title: `${batch.code} — Anomalie multi-signaux détectée (${result.recentDateRange![0]} → ${result.recentDateRange![1]})`,
      message,
      entityType: 'layer_batch',
      entityId: batch.id,
    });
  }
}
