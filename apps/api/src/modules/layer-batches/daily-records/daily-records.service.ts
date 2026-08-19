import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LayerBatch, type LayerDailyRecord } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { computeLotRemaining } from '../../egg-stock/calculations/egg-stock-lot.calculations';
import {
  computeHeadcountDelta,
  computeSuggestedHenCount,
} from '../calculations/layer-headcount.calculations';
import {
  computeEggsSellable,
  computeLayingRatePercent,
} from '../calculations/layer-eggs.calculations';
import type { CreateDailyRecordDto } from './dto/create-daily-record.dto';
import type { UpdateDailyRecordDto } from './dto/update-daily-record.dto';

@Injectable()
export class DailyRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Vérifie que le lot existe et appartient à la ferme courante — retourne
   * le lot (contrairement au pattern Broiler, on a besoin d'initialQuantity
   * pour la toute première journée). */
  private async assertBatchAccessible(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<LayerBatch> {
    const batch = await this.prisma.layerBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException('Lot introuvable.');
    }
    assertSameFarm(actingUser, batch.farmId);
    return batch;
  }

  async findAll(actingUser: AccessTokenPayload, batchId: string): Promise<LayerDailyRecord[]> {
    await this.assertBatchAccessible(actingUser, batchId);
    return this.prisma.layerDailyRecord.findMany({ where: { batchId }, orderBy: { date: 'asc' } });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    batchId: string,
    dateParam: string,
  ): Promise<LayerDailyRecord> {
    await this.assertBatchAccessible(actingUser, batchId);
    const record = await this.prisma.layerDailyRecord.findUnique({
      where: { batchId_date: { batchId, date: new Date(dateParam) } },
    });
    if (!record) {
      throw new NotFoundException('Journée de ponte introuvable.');
    }
    return record;
  }

  /**
   * Contrairement à BroilerDailyRecord (45 lignes pré-générées, update-only),
   * une journée de ponte est créée à la demande — pas de durée de cycle
   * fixe pour une pondeuse en production continue. Crée aussi
   * automatiquement le EggStockLot du jour si eggsSellable > 0 (§5.4),
   * atomique avec la création de la journée.
   */
  async create(
    actingUser: AccessTokenPayload,
    batchId: string,
    dto: CreateDailyRecordDto,
    ipAddress: string | null,
  ): Promise<LayerDailyRecord> {
    const batch = await this.assertBatchAccessible(actingUser, batchId);
    const date = new Date(dto.date);

    const previous = await this.prisma.layerDailyRecord.findFirst({
      where: { batchId, date: { lt: date } },
      orderBy: { date: 'desc' },
    });
    const suggestedHenCount = previous
      ? computeSuggestedHenCount(
          previous.henCount,
          previous.mortalityQuantity,
          previous.cullsQuantity,
          previous.otherExitsQuantity,
        )
      : batch.initialQuantity;
    const henCount = dto.henCount ?? suggestedHenCount;

    const eggsBroken = dto.eggsBroken ?? 0;
    const eggsRejected = dto.eggsRejected ?? 0;
    const eggsSellable = computeEggsSellable(dto.eggsLaid, eggsBroken, eggsRejected);
    const layingRatePercent = computeLayingRatePercent(dto.eggsLaid, henCount);

    let record: LayerDailyRecord;
    try {
      record = await this.prisma.$transaction(async (tx) => {
        const created = await tx.layerDailyRecord.create({
          data: {
            farmId: actingUser.farmId,
            batchId,
            date,
            operatorId: actingUser.sub,
            henCount,
            mortalityQuantity: dto.mortalityQuantity ?? 0,
            cullsQuantity: dto.cullsQuantity ?? 0,
            otherExitsQuantity: dto.otherExitsQuantity ?? 0,
            eggsLaid: dto.eggsLaid,
            eggsBroken,
            eggsRejected,
            eggsSellable,
            layingRatePercent,
            feedDistributedKg: dto.feedDistributedKg,
            observations: dto.observations,
          },
        });

        // §5.4 : pas de lot créé si rien à ajouter au stock.
        if (eggsSellable > 0) {
          await tx.eggStockLot.create({
            data: {
              farmId: actingUser.farmId,
              batchId,
              dailyRecordId: created.id,
              productionDate: date,
              quantityProduced: eggsSellable,
            },
          });
        }

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Une journée de ponte existe déjà pour cette date.');
      }
      throw error;
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'layer_daily_record',
      entityId: record.id,
      action: 'LAYER_DAILY_RECORD_CREATED',
      newValues: {
        henCount,
        suggestedHenCount,
        headcountDelta: computeHeadcountDelta(suggestedHenCount, henCount),
        eggsLaid: dto.eggsLaid,
        eggsSellable,
      },
      ipAddress,
    });

    return record;
  }

  /**
   * Correction d'une journée déjà saisie — jamais de `date` modifiable, pas
   * de DELETE exposé. Garde-fou : si la correction réduirait eggsSellable
   * sous la quantité déjà sortie du EggStockLot du jour (ventes/pertes déjà
   * enregistrées), le service bloque en 409 plutôt que de laisser un stock
   * négatif implicite. quantityProduced du lot suit la correction tant que
   * la garde-fou est respectée (jamais figé arbitrairement).
   */
  async update(
    actingUser: AccessTokenPayload,
    batchId: string,
    dateParam: string,
    dto: UpdateDailyRecordDto,
    ipAddress: string | null,
  ): Promise<LayerDailyRecord> {
    const existing = await this.findOne(actingUser, batchId, dateParam);

    const newEggsLaid = dto.eggsLaid ?? existing.eggsLaid;
    const newEggsBroken = dto.eggsBroken ?? existing.eggsBroken;
    const newEggsRejected = dto.eggsRejected ?? existing.eggsRejected;
    const newHenCount = dto.henCount ?? existing.henCount;
    const newEggsSellable = computeEggsSellable(newEggsLaid, newEggsBroken, newEggsRejected);
    const newLayingRatePercent = computeLayingRatePercent(newEggsLaid, newHenCount);

    const lot = await this.prisma.eggStockLot.findUnique({
      where: { dailyRecordId: existing.id },
      include: { movements: true },
    });

    if (lot) {
      const remaining = computeLotRemaining(lot.quantityProduced, lot.movements);
      const alreadyConsumed = lot.quantityProduced - remaining;
      if (newEggsSellable < alreadyConsumed) {
        throw new ConflictException(
          `Impossible de réduire les œufs commercialisables à ${newEggsSellable} : ${alreadyConsumed} déjà sortis du stock de cette journée.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.layerDailyRecord.update({
        where: { batchId_date: { batchId, date: existing.date } },
        data: {
          ...dto,
          eggsSellable: newEggsSellable,
          layingRatePercent: newLayingRatePercent,
          operatorId: actingUser.sub,
        },
      });

      if (lot && lot.quantityProduced !== newEggsSellable) {
        await tx.eggStockLot.update({
          where: { id: lot.id },
          data: { quantityProduced: newEggsSellable },
        });
      } else if (!lot && newEggsSellable > 0) {
        // La journée n'avait initialement rien de commercialisable (pas de
        // lot créé) — la correction en fait apparaître, on crée le lot.
        await tx.eggStockLot.create({
          data: {
            farmId: actingUser.farmId,
            batchId,
            dailyRecordId: record.id,
            productionDate: record.date,
            quantityProduced: newEggsSellable,
          },
        });
      }

      return record;
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'layer_daily_record',
      entityId: existing.id,
      action: 'LAYER_DAILY_RECORD_UPDATED',
      oldValues: {
        henCount: existing.henCount,
        eggsLaid: existing.eggsLaid,
        eggsSellable: existing.eggsSellable,
      },
      newValues: { ...dto, eggsSellable: newEggsSellable },
      ipAddress,
    });

    return updated;
  }
}
