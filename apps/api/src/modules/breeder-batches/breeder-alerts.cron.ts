import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import {
  computeExpectedCandlingDate,
  computeExpectedHatchDate,
} from '../incubation-batches/calculations/incubation-dates.calculations';
import {
  computeEmbryonicMortalityRatePercent,
  computeFertileEggs,
  computeHatchRatePercent,
} from '../incubation-batches/calculations/incubation-kpi.calculations';

const ACTIVE_BREEDER_STATUSES: Prisma.BreederBatchWhereInput['status'] = {
  notIn: ['CLOTURE', 'ANNULEE'],
};
const ACTIVE_INCUBATION_STATUSES: Prisma.IncubationBatchWhereInput['status'] = {
  equals: 'EN_INCUBATION',
};
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** §6.3 : ~21 jours pour poule — constante biologique, pas un seuil
 * sanitaire à sourcer avec la même rigueur (voir plan Phase 5). */
const DEFAULT_INCUBATION_DURATION_DAYS = 21;
/** §6.6 : jour 7, plusieurs sources concordantes (poultrykeeper.com,
 * imaginacres.com, incubatorwarehouse.com). */
const DEFAULT_CANDLING_DAY_OFFSET = 7;
/** poultryhatch.com : "en dessous de 50% = échec de gestion, 50-65% =
 * débutant, 70-80% = compétent, 80-90% = forte gestion, 90%+ = élite" ;
 * standard commercial 78-88%. */
const DEFAULT_HATCH_RATE_THRESHOLD_PERCENT = 70;
const DEFAULT_HATCH_RATE_CRITICAL_THRESHOLD_PERCENT = 50;
/** thepoultrysite.com : Hatch-of-Transfer 90-96% = "bon" avec ~4% de
 * mortalité embryonnaire totale ; mortalité précoce normale 2,5-5,5% ;
 * plage normale ~4-10% pour une exploitation bien gérée. */
const DEFAULT_EMBRYONIC_MORTALITY_THRESHOLD_PERCENT = 10;
const DEFAULT_EMBRYONIC_MORTALITY_CRITICAL_THRESHOLD_PERCENT = 20;

const SETTING_KEYS = {
  incubationDurationDays: 'incubation.duration_days',
  candlingDayOffset: 'incubation.candling_day_offset',
  hatchRateThreshold: 'incubation.hatch_rate_threshold_percent',
  hatchRateCriticalThreshold: 'incubation.hatch_rate_critical_threshold_percent',
  embryonicMortalityThreshold: 'incubation.embryonic_mortality_threshold_percent',
  embryonicMortalityCriticalThreshold: 'incubation.embryonic_mortality_critical_threshold_percent',
} as const;

/**
 * Couvre tout le domaine reproduction+couvoir (nom conservé malgré la
 * double responsabilité — voir plan Phase 5) : balayage BreederBatch
 * (absence de saisie) + balayage IncubationBatch (mirage/éclosion/KPI/
 * cohérence). Cron séparé de Broiler/Layer (même raisonnement qu'en
 * Phase 4 : jalons/clés de Setting structurellement différents).
 */
@Injectable()
export class BreederAlertsCronService {
  private readonly logger = new Logger(BreederAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui' })
  async runDailySweep(): Promise<void> {
    const breederBatches = await this.prisma.breederBatch.findMany({
      where: { status: ACTIVE_BREEDER_STATUSES },
    });
    for (const batch of breederBatches) {
      try {
        await this.checkMissingEntry(batch.farmId, batch.id, batch.code);
      } catch (error) {
        this.logger.error(`Échec du balayage (absence de saisie) pour le lot ${batch.id}`, error);
      }
    }

    const incubationBatches = await this.prisma.incubationBatch.findMany({
      where: { status: ACTIVE_INCUBATION_STATUSES },
    });
    for (const incubation of incubationBatches) {
      try {
        await this.processIncubationBatch(incubation.id);
      } catch (error) {
        this.logger.error(`Échec du balayage d'alertes pour l'incubation ${incubation.id}`, error);
      }
    }
  }

  private async alertAlreadyRaised(farmId: string, type: string, entityId: string): Promise<boolean> {
    const existing = await this.prisma.alert.findFirst({
      where: { farmId, type, entityId },
      select: { id: true },
    });
    return existing !== null;
  }

  private async getSettingNumber(farmId: string, key: string, fallback: number): Promise<number> {
    const setting = await this.prisma.setting.findUnique({ where: { farmId_key: { farmId, key } } });
    return typeof setting?.value === 'number' ? setting.value : fallback;
  }

  /** Contrairement au cron Broiler (operatorId IS NULL sur une ligne
   * pré-générée) et comme le cron Layer, il n'existe aucun placeholder côté
   * reproducteurs — l'absence de saisie se détecte par ABSENCE DE LIGNE. */
  private async checkMissingEntry(farmId: string, batchId: string, batchCode: string): Promise<void> {
    const yesterday = new Date(Date.now() - MS_PER_DAY);
    const record = await this.prisma.breederDailyRecord.findUnique({
      where: { batchId_date: { batchId, date: yesterday } },
    });
    if (record) {
      return;
    }
    const type = `breeder_missing_entry_${yesterday.toISOString().slice(0, 10)}`;
    if (await this.alertAlreadyRaised(farmId, type, batchId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: 'VIGILANCE',
      title: `${batchCode} — Aucune journée de production saisie pour le ${yesterday.toISOString().slice(0, 10)}`,
      entityType: 'breeder_batch',
      entityId: batchId,
    });
  }

  private async processIncubationBatch(incubationBatchId: string): Promise<void> {
    const incubation = await this.prisma.incubationBatch.findUniqueOrThrow({
      where: { id: incubationBatchId },
    });
    const today = new Date();

    const durationDays = await this.getSettingNumber(
      incubation.farmId,
      SETTING_KEYS.incubationDurationDays,
      DEFAULT_INCUBATION_DURATION_DAYS,
    );
    const candlingOffset = await this.getSettingNumber(
      incubation.farmId,
      SETTING_KEYS.candlingDayOffset,
      DEFAULT_CANDLING_DAY_OFFSET,
    );
    const expectedHatchDate = computeExpectedHatchDate(incubation.incubationStartDate, durationDays);
    const expectedCandlingDate = computeExpectedCandlingDate(incubation.incubationStartDate, candlingOffset);

    await this.checkCandlingDue(incubation.farmId, incubation.id, incubation.code, expectedCandlingDate, today);
    await this.checkHatchDue(incubation.farmId, incubation.id, incubation.code, expectedHatchDate, today);

    // KPI/cohérence : seulement une fois le bilan de mirage/éclosion saisi.
    if (incubation.chicksHatched !== null) {
      await this.checkHatchRate(incubation);
      await this.checkEmbryonicMortality(incubation);
      await this.checkCoherence(incubation);
    }
  }

  /** §6.6 : "Date de mirage à échéance." */
  private async checkCandlingDue(
    farmId: string,
    incubationBatchId: string,
    code: string,
    expectedCandlingDate: Date,
    today: Date,
  ): Promise<void> {
    if (today < expectedCandlingDate) {
      return;
    }
    const type = 'incubation_candling_due';
    if (await this.alertAlreadyRaised(farmId, type, incubationBatchId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type,
      severity: 'INFO',
      title: `${code} — Mirage à échéance (prévu le ${expectedCandlingDate.toISOString().slice(0, 10)})`,
      entityType: 'incubation_batch',
      entityId: incubationBatchId,
    });
  }

  /** §6.6 : "Éclosion prévue dans 48h / 24h." Un seul jalon par franchissement. */
  private async checkHatchDue(
    farmId: string,
    incubationBatchId: string,
    code: string,
    expectedHatchDate: Date,
    today: Date,
  ): Promise<void> {
    const hoursUntilHatch = (expectedHatchDate.getTime() - today.getTime()) / (60 * 60 * 1000);
    let milestone: { type: string; title: string } | null = null;
    if (hoursUntilHatch <= 24 && hoursUntilHatch > -24) {
      milestone = { type: 'incubation_hatch_due_24h', title: 'Éclosion prévue sous 24h' };
    } else if (hoursUntilHatch <= 48 && hoursUntilHatch > 24) {
      milestone = { type: 'incubation_hatch_due_48h', title: 'Éclosion prévue sous 48h' };
    }
    if (!milestone) {
      return;
    }
    if (await this.alertAlreadyRaised(farmId, milestone.type, incubationBatchId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type: milestone.type,
      severity: 'IMPORTANT',
      title: `${code} — ${milestone.title} (${expectedHatchDate.toISOString().slice(0, 10)})`,
      entityType: 'incubation_batch',
      entityId: incubationBatchId,
    });
  }

  private async checkHatchRate(incubation: {
    farmId: string;
    id: string;
    code: string;
    eggCount: number;
    chicksHatched: number | null;
  }): Promise<void> {
    const hatchRate = computeHatchRatePercent(incubation.chicksHatched ?? 0, incubation.eggCount);
    const threshold = await this.getSettingNumber(
      incubation.farmId,
      SETTING_KEYS.hatchRateThreshold,
      DEFAULT_HATCH_RATE_THRESHOLD_PERCENT,
    );
    if (hatchRate >= threshold) {
      return;
    }
    const criticalThreshold = await this.getSettingNumber(
      incubation.farmId,
      SETTING_KEYS.hatchRateCriticalThreshold,
      DEFAULT_HATCH_RATE_CRITICAL_THRESHOLD_PERCENT,
    );
    const type = 'incubation_low_hatch_rate';
    if (await this.alertAlreadyRaised(incubation.farmId, type, incubation.id)) {
      return;
    }
    await this.alertsService.createSystemAlert(incubation.farmId, {
      type,
      severity: hatchRate <= criticalThreshold ? 'CRITIQUE' : 'IMPORTANT',
      title: `${incubation.code} — Taux d'éclosion faible (${hatchRate.toFixed(2)} %)`,
      entityType: 'incubation_batch',
      entityId: incubation.id,
    });
  }

  private async checkEmbryonicMortality(incubation: {
    farmId: string;
    id: string;
    code: string;
    eggCount: number;
    eggsInfertile: number | null;
    embryonicMortality: number | null;
  }): Promise<void> {
    const fertileEggs = computeFertileEggs(incubation.eggCount, incubation.eggsInfertile ?? 0);
    const rate = computeEmbryonicMortalityRatePercent(incubation.embryonicMortality ?? 0, fertileEggs);
    const threshold = await this.getSettingNumber(
      incubation.farmId,
      SETTING_KEYS.embryonicMortalityThreshold,
      DEFAULT_EMBRYONIC_MORTALITY_THRESHOLD_PERCENT,
    );
    if (rate <= threshold) {
      return;
    }
    const criticalThreshold = await this.getSettingNumber(
      incubation.farmId,
      SETTING_KEYS.embryonicMortalityCriticalThreshold,
      DEFAULT_EMBRYONIC_MORTALITY_CRITICAL_THRESHOLD_PERCENT,
    );
    const type = 'incubation_high_embryonic_mortality';
    if (await this.alertAlreadyRaised(incubation.farmId, type, incubation.id)) {
      return;
    }
    await this.alertsService.createSystemAlert(incubation.farmId, {
      type,
      severity: rate >= criticalThreshold ? 'CRITIQUE' : 'IMPORTANT',
      title: `${incubation.code} — Mortalité embryonnaire élevée (${rate.toFixed(2)} %)`,
      entityType: 'incubation_batch',
      entityId: incubation.id,
    });
  }

  /** §6.6 : "Écart important entre œufs incubés et bilan final." */
  private async checkCoherence(incubation: {
    farmId: string;
    id: string;
    code: string;
    eggCount: number;
    eggsInfertile: number | null;
    eggsInfected: number | null;
    embryonicMortality: number | null;
    chicksHatched: number | null;
  }): Promise<void> {
    const type = 'incubation_coherence';
    if (await this.alertAlreadyRaised(incubation.farmId, type, incubation.id)) {
      return;
    }
    const accounted =
      (incubation.eggsInfertile ?? 0) +
      (incubation.eggsInfected ?? 0) +
      (incubation.embryonicMortality ?? 0) +
      (incubation.chicksHatched ?? 0);
    if (accounted === incubation.eggCount) {
      return;
    }
    await this.alertsService.createSystemAlert(incubation.farmId, {
      type,
      severity: 'CRITIQUE',
      title: `${incubation.code} — Écart de cohérence (œufs incubés : ${incubation.eggCount}, bilan : ${accounted})`,
      entityType: 'incubation_batch',
      entityId: incubation.id,
    });
  }
}
