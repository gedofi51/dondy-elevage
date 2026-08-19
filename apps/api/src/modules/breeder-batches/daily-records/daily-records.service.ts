import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type BreederBatch, type BreederDailyRecord } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { BreederBatchesService } from '../breeder-batches.service';
import type { CreateDailyRecordDto } from './dto/create-daily-record.dto';
import type { UpdateDailyRecordDto } from './dto/update-daily-record.dto';

@Injectable()
export class DailyRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly breederBatchesService: BreederBatchesService,
  ) {}

  private async assertBatchAccessible(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<BreederBatch> {
    const batch = await this.prisma.breederBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException('Lot introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
    return batch;
  }

  async findAll(actingUser: AccessTokenPayload, batchId: string): Promise<BreederDailyRecord[]> {
    await this.assertBatchAccessible(actingUser, batchId);
    return this.prisma.breederDailyRecord.findMany({ where: { batchId }, orderBy: { date: 'asc' } });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    batchId: string,
    dateParam: string,
  ): Promise<BreederDailyRecord> {
    await this.assertBatchAccessible(actingUser, batchId);
    const record = await this.prisma.breederDailyRecord.findUnique({
      where: { batchId_date: { batchId, date: new Date(dateParam) } },
    });
    if (!record) {
      throw new NotFoundException('Journée de production introuvable.');
    }
    return record;
  }

  /** Créée à la demande — reproducteurs à cycle long, pas de génération en
   * masse (même principe que layer-batches/daily-records). */
  async create(
    actingUser: AccessTokenPayload,
    batchId: string,
    dto: CreateDailyRecordDto,
    ipAddress: string | null,
  ): Promise<BreederDailyRecord> {
    await this.assertBatchAccessible(actingUser, batchId);
    const date = new Date(dto.date);

    let record: BreederDailyRecord;
    try {
      record = await this.prisma.breederDailyRecord.create({
        data: {
          farmId: actingUser.farmId,
          batchId,
          date,
          operatorId: actingUser.sub,
          eggsLaid: dto.eggsLaid,
          eggsSelectedForIncubation: dto.eggsSelectedForIncubation ?? 0,
          eggsRejected: dto.eggsRejected ?? 0,
          eggsSold: dto.eggsSold ?? 0,
          observations: dto.observations,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Une journée de production existe déjà pour cette date.');
      }
      throw error;
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'breeder_daily_record',
      entityId: record.id,
      action: 'BREEDER_DAILY_RECORD_CREATED',
      newValues: {
        eggsLaid: dto.eggsLaid,
        eggsSelectedForIncubation: record.eggsSelectedForIncubation,
      },
      ipAddress,
    });

    return record;
  }

  /**
   * Correction d'une journée déjà saisie — jamais de `date` modifiable, pas
   * de DELETE exposé. Garde-fou : si la correction réduit
   * eggsSelectedForIncubation au point de faire passer la disponibilité
   * cumulée du lot (voir BreederBatchesService.computeAvailableFertileEggsForBatch)
   * sous zéro (des IncubationBatch ont déjà consommé plus que ce qui
   * resterait sélectionné), le service bloque en 409.
   */
  async update(
    actingUser: AccessTokenPayload,
    batchId: string,
    dateParam: string,
    dto: UpdateDailyRecordDto,
    ipAddress: string | null,
  ): Promise<BreederDailyRecord> {
    const existing = await this.findOne(actingUser, batchId, dateParam);

    if (dto.eggsSelectedForIncubation !== undefined) {
      const currentAvailable = await this.breederBatchesService.computeAvailableFertileEggsForBatch(batchId);
      const delta = dto.eggsSelectedForIncubation - existing.eggsSelectedForIncubation;
      if (currentAvailable + delta < 0) {
        throw new ConflictException(
          `Impossible de réduire les œufs sélectionnés pour incubation à ${dto.eggsSelectedForIncubation} : des lots d'incubation ont déjà consommé plus que ce qui resterait disponible.`,
        );
      }
    }

    const updated = await this.prisma.breederDailyRecord.update({
      where: { batchId_date: { batchId, date: existing.date } },
      data: { ...dto, operatorId: actingUser.sub },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'breeder_daily_record',
      entityId: existing.id,
      action: 'BREEDER_DAILY_RECORD_UPDATED',
      oldValues: {
        eggsLaid: existing.eggsLaid,
        eggsSelectedForIncubation: existing.eggsSelectedForIncubation,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
