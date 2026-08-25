import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { MaintenanceTask } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

const MS_PER_DAY = 86_400_000;
const DEFAULT_DUE_SOON_DAYS = 7;

type TaskWithAssetCode = MaintenanceTask & { asset: { code: string } };

/**
 * Cahier V6 §19 : "Maintenance pompe à échéance" → "Tâche créée et
 * responsable alerté" ; §13 : bloc dashboard "Interventions à venir,
 * retards, coûts". Même patron exact que AssetsAlertsCronService (Phase
 * 16) : balayage quotidien, try/catch par tâche, idempotence par alerte
 * d'état. `entityId` reste l'id de la tâche (jamais Asset.responsibleId) —
 * "responsable alerté" est interprété comme un broadcast ferme-entière via
 * NotificationsService.notifyForAlert (tous les titulaires d'un rôle
 * portant ALERTS_ACKNOWLEDGE) : aucun mécanisme de ciblage individuel par
 * utilisateur n'existe dans le code actuel, voir DETTE_TECHNIQUE.md
 * Phase 17. Sévérité IMPORTANT (pas VIGILANCE) pour le retard — délibéré,
 * pour franchir le seuil NOTIFIED_SEVERITIES et produire une vraie
 * notification.
 */
@Injectable()
export class MaintenanceAlertsCronService {
  private readonly logger = new Logger(MaintenanceAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui', unrefTimeout: true })
  async runDailySweep(): Promise<void> {
    const tasks = await this.prisma.maintenanceTask.findMany({
      where: {
        status: { in: ['A_FAIRE', 'EN_COURS'] },
        asset: { status: { not: 'REFORME' } },
      },
      include: { asset: { select: { code: true } } },
    });
    for (const task of tasks) {
      try {
        await this.processTask(task);
      } catch (error) {
        this.logger.error(`Échec du balayage d'alertes pour la tâche ${task.id}`, error);
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

  private async processTask(task: TaskWithAssetCode): Promise<void> {
    const daysUntilDue = Math.floor((task.dueDate.getTime() - Date.now()) / MS_PER_DAY);
    if (daysUntilDue < 0) {
      await this.raiseOverdue(task);
    } else {
      await this.raiseDueSoon(task, daysUntilDue);
    }
  }

  /** Délai de préavis assumé comme paramètre d'ingénierie (le cahier ne le
   * chiffre pas) — reconfigurable via Setting, même traitement que le
   * seuil garantie de Phase 16. */
  private async raiseDueSoon(task: TaskWithAssetCode, daysUntilDue: number): Promise<void> {
    const warningDays = await this.getSettingNumber(
      task.farmId,
      'maintenance.task_due_soon_days',
      DEFAULT_DUE_SOON_DAYS,
    );
    if (daysUntilDue > warningDays) {
      return;
    }

    const type = 'maintenance_task_due_soon';
    if (await this.alertAlreadyRaised(task.farmId, type, task.id)) {
      return;
    }

    await this.alertsService.createSystemAlert(task.farmId, {
      type,
      severity: 'VIGILANCE',
      title: `${task.asset.code} — Maintenance à échéance proche`,
      entityType: 'maintenance_task',
      entityId: task.id,
    });
  }

  private async raiseOverdue(task: TaskWithAssetCode): Promise<void> {
    const type = 'maintenance_task_overdue';
    if (await this.alertAlreadyRaised(task.farmId, type, task.id)) {
      return;
    }

    await this.alertsService.createSystemAlert(task.farmId, {
      type,
      severity: 'IMPORTANT',
      title: `${task.asset.code} — Maintenance en retard`,
      entityType: 'maintenance_task',
      entityId: task.id,
    });
  }
}
