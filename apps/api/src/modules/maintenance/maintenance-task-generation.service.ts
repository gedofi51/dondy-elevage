import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeNextDueDate } from './calculations/next-due-date.calculations';

interface LockedPlanRow {
  id: string;
  farmId: string;
  assetId: string;
  designation: string;
  periodicityDays: number;
  startDate: Date;
  active: number | boolean;
}

/**
 * Génération des tâches préventives à la demande (décision C.1, voir
 * DETTE_TECHNIQUE.md Phase 17) — analogue à LayerBatchesService (création
 * à la demande, durée ouverte), pas à BroilerBatchesService/AssetsService
 * (pré-génération en masse, durée fixe connue). Logique centralisée ici,
 * réutilisée par 3 points d'entrée transactionnels (clôture de tâche par
 * intervention, annulation de tâche, cron de rattrapage quotidien) —
 * jamais dupliquée.
 */
@Injectable()
export class MaintenanceTaskGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verrouille la ligne MaintenancePlan (`SELECT ... FOR UPDATE`, même
   * pattern que le verrouillage Item dans
   * StockMovementsService.recordMovementInTransaction) avant de
   * vérifier/créer la tâche suivante — le projet a une histoire
   * documentée de ce bug de concurrence exact (3 occurrences corrigées en
   * Phase 8, voir DETTE_TECHNIQUE.md). `tx` obligatoire : cette méthode
   * ne doit jamais s'exécuter hors d'une transaction déjà ouverte par
   * l'appelant.
   */
  async ensureNextTaskGenerated(tx: Prisma.TransactionClient, planId: string): Promise<void> {
    const rows = await tx.$queryRaw<LockedPlanRow[]>`
      SELECT id, farmId, assetId, designation, periodicityDays, startDate, active
      FROM maintenance_plans
      WHERE id = ${planId}
      FOR UPDATE
    `;
    const plan = rows[0];
    if (!plan || !plan.active) {
      return;
    }

    const asset = await tx.asset.findUnique({
      where: { id: plan.assetId },
      select: { status: true },
    });
    if (!asset || asset.status === 'REFORME') {
      return;
    }

    const openTaskCount = await tx.maintenanceTask.count({
      where: { planId, status: { in: ['A_FAIRE', 'EN_COURS'] } },
    });
    if (openTaskCount > 0) {
      return;
    }

    // Ancrage sur la dernière intervention RÉELLE du plan — jamais sur une
    // tâche annulée, pour ne pas laisser le planning dériver silencieusement
    // en l'absence de toute maintenance réelle (voir DETTE_TECHNIQUE.md).
    const lastIntervention = await tx.maintenanceIntervention.findFirst({
      where: { task: { planId } },
      orderBy: { interventionDate: 'desc' },
      select: { interventionDate: true },
    });
    const anchor = lastIntervention?.interventionDate ?? plan.startDate;
    const dueDate = computeNextDueDate(anchor, plan.periodicityDays);

    await tx.maintenanceTask.create({
      data: {
        farmId: plan.farmId,
        assetId: plan.assetId,
        planId: plan.id,
        type: 'PREVENTIVE',
        designation: plan.designation,
        dueDate,
      },
    });
  }
}
