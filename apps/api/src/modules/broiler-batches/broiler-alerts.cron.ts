import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { computeDayNumber, resolveCalendarMilestone } from './calculations/broiler-calendar';
import {
  computeDailyMortalityRate,
  computeStartedQuantity,
} from './calculations/broiler-headcount.calculations';

const ACTIVE_STATUSES: Prisma.BroilerBatchWhereInput['status'] = {
  notIn: ['CLOTUREE', 'ANNULEE'],
};

/** §9.1 : seuil sourcé (pas arbitraire) — voir docs/reference/ALERTES.md et
 * le résumé de mission Phase 3 pour la citation complète. "Reviewing the
 * Definition of Mortality in Broiler Chickens" (PMC10633162) définit 0,5 %/j
 * comme une hausse "dramatique" — seuil unique valable sur tout le cycle
 * J1-J45 (y compris le pic naturel J3-J4), donc calé sur cette borne plutôt
 * que sur la moyenne hors-pic (~0,05 %/j), pour éviter la fatigue d'alerte
 * en début de cycle. Reconfigurable par ferme sans déploiement (Setting). */
const DEFAULT_MORTALITY_THRESHOLD_PERCENT = 0.5;
const MORTALITY_THRESHOLD_SETTING_KEY = 'broiler.mortality_threshold_percent';

/**
 * Moteur de règles Phase 3 branché sur le moteur d'alertes générique de la
 * Phase 2 (voir AlertsService.createSystemAlert). Premier job planifié du
 * projet — @nestjs/schedule choisi pour un unique passage quotidien
 * in-process (un seul conteneur API, pas de pattern de file d'attente
 * ailleurs dans le code ; Redis présent mais inutilisé, pas de justification
 * à BullMQ ici). Idempotence par vérification applicative (une alerte du même
 * type+entité n'est jamais recréée), pas par contrainte unique en base (le
 * modèle Alert est partagé par toutes les fonctionnalités présentes et futures).
 */
@Injectable()
export class BroilerAlertsCronService {
  private readonly logger = new Logger(BroilerAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui' })
  async runDailySweep(): Promise<void> {
    const batches = await this.prisma.broilerBatch.findMany({
      where: { status: ACTIVE_STATUSES },
    });

    for (const batch of batches) {
      try {
        await this.processBatch(batch.id);
      } catch (error) {
        // Un batch en erreur ne doit jamais interrompre le balayage des autres.
        this.logger.error(`Échec du balayage d'alertes pour la bande ${batch.id}`, error);
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

  private async processBatch(batchId: string): Promise<void> {
    const batch = await this.prisma.broilerBatch.findUniqueOrThrow({ where: { id: batchId } });
    const today = new Date();
    const dayNumber = computeDayNumber(batch.arrivalDate, today);

    await this.checkCalendarMilestone(batch.farmId, batch.id, batch.code, dayNumber);
    await this.checkPreviousDayIssues(batch, dayNumber);
    await this.checkMortalityCoherence(batch);
  }

  /** §9 : jalons calendaires J1-J45+, une seule fois par jalon par bande. */
  private async checkCalendarMilestone(
    farmId: string,
    batchId: string,
    batchCode: string,
    dayNumber: number,
  ): Promise<void> {
    const milestone = resolveCalendarMilestone(dayNumber);
    if (!milestone) {
      return;
    }
    if (await this.alertAlreadyRaised(farmId, milestone.type, batchId)) {
      return;
    }
    await this.alertsService.createSystemAlert(farmId, {
      type: milestone.type,
      severity: milestone.severity,
      title: `${batchCode} — ${milestone.title}`,
      entityType: 'broiler_batch',
      entityId: batchId,
    });
  }

  /**
   * §9.1 : "absence de saisie quotidienne" (le jour précédent n'a jamais été
   * rempli — operatorId NULL, signal déjà présent sur BroilerDailyRecord,
   * pas de colonne dédiée supplémentaire) + "mortalité élevée" (taux du jour
   * précédent comparé au seuil configurable de la ferme). Le jour courant
   * n'est volontairement jamais vérifié : il peut légitimement ne pas encore
   * être rempli au moment du passage du cron.
   */
  private async checkPreviousDayIssues(
    batch: {
      id: string;
      farmId: string;
      code: string;
      receivedQuantity: number;
      deadOnArrivalQuantity: number;
    },
    dayNumber: number,
  ): Promise<void> {
    const previousDay = dayNumber - 1;
    if (previousDay < 1 || previousDay > 45) {
      return;
    }

    const record = await this.prisma.broilerDailyRecord.findUnique({
      where: { batchId_dayNumber: { batchId: batch.id, dayNumber: previousDay } },
    });
    if (!record) {
      return;
    }

    if (record.operatorId === null) {
      const type = `batch_missing_entry_j${previousDay}`;
      if (!(await this.alertAlreadyRaised(batch.farmId, type, batch.id))) {
        await this.alertsService.createSystemAlert(batch.farmId, {
          type,
          severity: 'VIGILANCE',
          title: `${batch.code} — Aucune saisie quotidienne pour J${previousDay}`,
          entityType: 'broiler_batch',
          entityId: batch.id,
        });
      }
      // Pas de taux de mortalité fiable à évaluer sans saisie ce jour-là.
      return;
    }

    const startedQuantity = computeStartedQuantity(
      batch.receivedQuantity,
      batch.deadOnArrivalQuantity,
    );
    const headcountStartOfDay = startedQuantity; // approximation V1 : pas de recalcul jour par jour de l'effectif de début de journée exact.
    const dailyRate = computeDailyMortalityRate(record.mortalityQuantity, headcountStartOfDay);

    const setting = await this.prisma.setting.findUnique({
      where: { farmId_key: { farmId: batch.farmId, key: MORTALITY_THRESHOLD_SETTING_KEY } },
    });
    const threshold =
      typeof setting?.value === 'number' ? setting.value : DEFAULT_MORTALITY_THRESHOLD_PERCENT;

    if (dailyRate > threshold) {
      const type = `batch_high_mortality_j${previousDay}`;
      if (!(await this.alertAlreadyRaised(batch.farmId, type, batch.id))) {
        await this.alertsService.createSystemAlert(batch.farmId, {
          type,
          // Hausse "dramatique" (>2x le seuil) -> CRITIQUE, sinon IMPORTANT.
          severity: dailyRate > threshold * 2 ? 'CRITIQUE' : 'IMPORTANT',
          title: `${batch.code} — Mortalité élevée le J${previousDay} (${dailyRate.toFixed(2)} %)`,
          entityType: 'broiler_batch',
          entityId: batch.id,
        });
      }
    }
  }

  /** §17 : "toute divergence doit produire une alerte de cohérence" — entre
   * BroilerDailyRecord.mortalityQuantity (référence rapide) et le détail
   * BroilerMortality par cause. */
  private async checkMortalityCoherence(batch: {
    id: string;
    farmId: string;
    code: string;
  }): Promise<void> {
    const type = 'batch_coherence';
    if (await this.alertAlreadyRaised(batch.farmId, type, batch.id)) {
      return;
    }

    const [dailyAgg, detailedAgg] = await Promise.all([
      this.prisma.broilerDailyRecord.aggregate({
        where: { batchId: batch.id },
        _sum: { mortalityQuantity: true },
      }),
      this.prisma.broilerMortality.aggregate({
        where: { batchId: batch.id, deletedAt: null },
        _sum: { quantity: true },
      }),
    ]);

    const dailyTotal = dailyAgg._sum.mortalityQuantity ?? 0;
    const detailedTotal = detailedAgg._sum.quantity ?? 0;
    // Rien à comparer si le détail par cause n'a jamais été saisi.
    if (detailedTotal === 0 || dailyTotal === detailedTotal) {
      return;
    }

    await this.alertsService.createSystemAlert(batch.farmId, {
      type,
      severity: 'CRITIQUE',
      title: `${batch.code} — Écart de cohérence mortalité (suivi quotidien : ${dailyTotal}, détail par cause : ${detailedTotal})`,
      entityType: 'broiler_batch',
      entityId: batch.id,
    });
  }
}
