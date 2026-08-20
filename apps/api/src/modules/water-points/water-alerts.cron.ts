import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { safeDivide } from '../../common/calculations/safe-math.util';

const ACTIVE_STATUS: Prisma.WaterPointWhereInput['status'] = 'ACTIF';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Aucune source publiée pour une tolérance de caisse d'un point de vente
 * d'eau informel (contrairement aux seuils avicoles sourcés des phases
 * précédentes) — paramètres d'ingénierie assumés, signalés comme tels,
 * même traitement que DEFAULT_FEED_DEVIATION_THRESHOLD_PERCENT (Phase 4).
 * Deux seuils combinés (OR) : le plancher FCFA est un filet de sécurité
 * pour le cas theoreticalAmountFcfa = 0, où safeDivide renvoie 0 et
 * masquerait un écart réel en pourcentage pur. */
const DEFAULT_CASH_VARIANCE_THRESHOLD_PERCENT = 5;
const DEFAULT_CASH_VARIANCE_THRESHOLD_FCFA_FLOOR = 2_000;

const SETTING_KEYS = {
  cashVarianceThresholdPercent: 'water.cash_variance_threshold_percent',
  cashVarianceThresholdFcfaFloor: 'water.cash_variance_threshold_fcfa_floor',
} as const;

/**
 * Cron séparé (comme Broiler/Layer/Breeder) : aucun jalon calendaire ni clé
 * de Setting partagée avec les autres domaines. L'incohérence d'index
 * (§7.3) n'est PAS balayée ici — bloquée immédiatement (400/409) à
 * l'écriture, voir WaterReadingsService ; elle ne peut jamais être
 * persistée sans justification, donc rien à détecter a posteriori.
 */
@Injectable()
export class WaterAlertsCronService {
  private readonly logger = new Logger(WaterAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui' })
  async runDailySweep(): Promise<void> {
    const waterPoints = await this.prisma.waterPoint.findMany({
      where: { status: ACTIVE_STATUS },
    });
    for (const waterPoint of waterPoints) {
      try {
        await this.processWaterPoint(waterPoint.id);
      } catch (error) {
        // Un point en erreur ne doit jamais interrompre le balayage des autres.
        this.logger.error(
          `Échec du balayage d'alertes pour le point d'eau ${waterPoint.id}`,
          error,
        );
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

  private async processWaterPoint(waterPointId: string): Promise<void> {
    const waterPoint = await this.prisma.waterPoint.findUniqueOrThrow({
      where: { id: waterPointId },
    });
    const today = new Date();
    const yesterday = new Date(today.getTime() - MS_PER_DAY);

    await this.checkMissingEntry(waterPoint.farmId, waterPoint.id, waterPoint.code, yesterday);
    await this.checkCashVarianceThreshold(
      waterPoint.farmId,
      waterPoint.id,
      waterPoint.code,
      yesterday,
    );
  }

  /** Pattern absence-de-ligne (comme Layer/Breeder, pas de placeholder). */
  private async checkMissingEntry(
    farmId: string,
    waterPointId: string,
    waterPointCode: string,
    yesterday: Date,
  ): Promise<void> {
    const reading = await this.prisma.waterReading.findUnique({
      where: { waterPointId_date: { waterPointId, date: yesterday } },
    });
    if (reading) {
      return;
    }
    const dateStr = yesterday.toISOString().slice(0, 10);
    const type = `water_missing_entry_${dateStr}`;
    if (await this.alertAlreadyRaised(farmId, type, waterPointId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: 'VIGILANCE',
      title: `${waterPointCode} — Aucun relevé saisi pour le ${dateStr}`,
      entityType: 'water_point',
      entityId: waterPointId,
    });
  }

  private async checkCashVarianceThreshold(
    farmId: string,
    waterPointId: string,
    waterPointCode: string,
    yesterday: Date,
  ): Promise<void> {
    const reading = await this.prisma.waterReading.findUnique({
      where: { waterPointId_date: { waterPointId, date: yesterday } },
    });
    if (!reading) {
      return;
    }

    const percentThreshold = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.cashVarianceThresholdPercent,
      DEFAULT_CASH_VARIANCE_THRESHOLD_PERCENT,
    );
    const floorThreshold = await this.getSettingNumber(
      farmId,
      SETTING_KEYS.cashVarianceThresholdFcfaFloor,
      DEFAULT_CASH_VARIANCE_THRESHOLD_FCFA_FLOOR,
    );

    const absVarianceFcfa = Math.abs(reading.varianceFcfa);
    const variancePercent = safeDivide(absVarianceFcfa, reading.theoreticalAmountFcfa) * 100;
    if (variancePercent <= percentThreshold && absVarianceFcfa <= floorThreshold) {
      return;
    }

    const dateStr = yesterday.toISOString().slice(0, 10);
    const type = `water_cash_variance_${dateStr}`;
    if (await this.alertAlreadyRaised(farmId, type, waterPointId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: 'IMPORTANT',
      title: `${waterPointCode} — Écart de caisse significatif le ${dateStr} (${reading.varianceFcfa} FCFA)`,
      entityType: 'water_point',
      entityId: waterPointId,
    });
  }
}
