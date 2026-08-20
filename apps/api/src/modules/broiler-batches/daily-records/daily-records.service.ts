import { Injectable, NotFoundException } from '@nestjs/common';
import type { BroilerDailyRecord } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { StockMovementsService } from '../../stock-movements/stock-movements.service';
import { computeAverageWeightG } from '../calculations/broiler-growth.calculations';
import { computeFeedMovementInstructions } from '../../items/calculations/feed-movement.calculations';
import type { UpdateDailyRecordDto } from './dto/update-daily-record.dto';

@Injectable()
export class DailyRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  /** Vérifie que la bande existe et appartient à la ferme courante — les
   * journées de suivi n'ont pas d'existence sans une bande valide. */
  private async assertBatchAccessible(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<void> {
    const batch = await this.prisma.broilerBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException('Bande introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
  }

  async findAll(actingUser: AccessTokenPayload, batchId: string): Promise<BroilerDailyRecord[]> {
    await this.assertBatchAccessible(actingUser, batchId);
    return this.prisma.broilerDailyRecord.findMany({
      where: { batchId },
      orderBy: { dayNumber: 'asc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    batchId: string,
    dayNumber: number,
  ): Promise<BroilerDailyRecord> {
    await this.assertBatchAccessible(actingUser, batchId);
    const record = await this.prisma.broilerDailyRecord.findUnique({
      where: { batchId_dayNumber: { batchId, dayNumber } },
    });
    if (!record) {
      throw new NotFoundException('Journée de suivi introuvable.');
    }
    return record;
  }

  /**
   * Jamais de create/delete exposés : les 45 lignes sont générées à la
   * création de la bande (BroilerBatchesService.create) et permanentes.
   * operatorId auto-rempli avec l'utilisateur courant — signal réutilisé par
   * le cron "absence de saisie quotidienne" (voir BroilerAlertsCronService).
   *
   * Phase 7 — hook automatique §8.3 "distribution aliment poulets" : si
   * feedItemId est renseigné (additif, comportement historique inchangé
   * sinon), toute correction de feedDistributedKg déclenche un mouvement
   * de stock EN DELTA (computeFeedMovementInstructions, jamais la valeur
   * brute — cette méthode peut être PATCHée plusieurs fois pour le même
   * jour) + une Expense pour la charge correspondante. Introduit une
   * transaction ici (n'en avait aucune jusqu'ici) pour coupler
   * atomiquement la mise à jour de la ligne + les mouvements de stock.
   * Une réduction (RETOUR) ne modifie/annule PAS l'Expense déjà créée par
   * une distribution antérieure — limite assumée et documentée (voir
   * DETTE_TECHNIQUE.md), une correction financière repasse par le module
   * Expenses lui-même.
   */
  async update(
    actingUser: AccessTokenPayload,
    batchId: string,
    dayNumber: number,
    dto: UpdateDailyRecordDto,
    ipAddress: string | null,
  ): Promise<BroilerDailyRecord> {
    const existing = await this.findOne(actingUser, batchId, dayNumber);

    const averageWeightG =
      dto.totalSampleWeightG !== undefined && dto.sampleSize !== undefined
        ? Math.round(computeAverageWeightG(dto.totalSampleWeightG, dto.sampleSize))
        : undefined;

    const nextFeedItemId = dto.feedItemId !== undefined ? dto.feedItemId : existing.feedItemId;
    const nextFeedDistributedKg =
      dto.feedDistributedKg !== undefined
        ? dto.feedDistributedKg
        : existing.feedDistributedKg
          ? Number(existing.feedDistributedKg)
          : 0;
    const instructions = computeFeedMovementInstructions(
      existing.feedItemId,
      existing.feedDistributedKg ? Number(existing.feedDistributedKg) : 0,
      nextFeedItemId,
      nextFeedDistributedKg,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.broilerDailyRecord.update({
        where: { batchId_dayNumber: { batchId, dayNumber } },
        data: {
          ...dto,
          averageWeightG,
          operatorId: actingUser.sub,
        },
      });

      for (const instruction of instructions) {
        const movement = await this.stockMovementsService.recordMovementInTransaction(tx, {
          farmId: actingUser.farmId,
          itemId: instruction.itemId,
          type: instruction.type,
          reason: instruction.reason,
          quantity: instruction.quantity,
          date: record.date,
          createdBy: actingUser.sub,
          sourceType: 'broiler_daily_record',
          sourceId: record.id,
        });
        if (instruction.reason === 'DISTRIBUTION_BANDE') {
          await tx.expense.create({
            data: {
              farmId: actingUser.farmId,
              batchId,
              date: record.date,
              category: 'Alimentation',
              description: 'Distribution aliment (mouvement de stock automatique)',
              quantity: movement.quantity,
              unitPriceFcfa: movement.unitCostFcfaSnapshot,
              amountFcfa: movement.totalValueFcfa,
              createdBy: actingUser.sub,
            },
          });
        }
      }

      return record;
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'broiler_daily_record',
      entityId: existing.id,
      action: 'DAILY_RECORD_UPDATED',
      oldValues: {
        mortalityQuantity: existing.mortalityQuantity,
        cullsQuantity: existing.cullsQuantity,
        otherExitsQuantity: existing.otherExitsQuantity,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
