import { Injectable, NotFoundException } from '@nestjs/common';
import type { BroilerDailyRecord } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { computeAverageWeightG } from '../calculations/broiler-growth.calculations';
import type { UpdateDailyRecordDto } from './dto/update-daily-record.dto';

@Injectable()
export class DailyRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
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

    const updated = await this.prisma.broilerDailyRecord.update({
      where: { batchId_dayNumber: { batchId, dayNumber } },
      data: {
        ...dto,
        averageWeightG,
        operatorId: actingUser.sub,
      },
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
