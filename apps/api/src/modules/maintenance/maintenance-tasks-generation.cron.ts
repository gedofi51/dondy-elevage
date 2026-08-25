import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceTaskGenerationService } from './maintenance-task-generation.service';

/**
 * Filet de sécurité, PAS le mécanisme primaire de génération (celui-ci vit
 * dans MaintenanceTasksService.cancel()/markRealizedInTransaction(), voir
 * DETTE_TECHNIQUE.md Phase 17, décision C.1) — rattrape les cas résiduels
 * (bug, tâche restée orpheline). Même patron exact que les autres crons du
 * projet (AssetsAlertsCronService, ItemsAlertsCronService...).
 */
@Injectable()
export class MaintenanceTasksGenerationCronService {
  private readonly logger = new Logger(MaintenanceTasksGenerationCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generationService: MaintenanceTaskGenerationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui', unrefTimeout: true })
  async runDailySweep(): Promise<void> {
    const plans = await this.prisma.maintenancePlan.findMany({ where: { active: true } });
    for (const plan of plans) {
      try {
        await this.prisma.$transaction((tx) =>
          this.generationService.ensureNextTaskGenerated(tx, plan.id),
        );
      } catch (error) {
        // Un plan en erreur ne doit jamais interrompre le balayage des autres.
        this.logger.error(`Échec de la génération de tâche pour le plan ${plan.id}`, error);
      }
    }
  }
}
