import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type WaterReading } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { WaterPointsService } from '../water-points.service';
import {
  computeConsumptionM3,
  computeSalesCashGapFcfa,
  computeTheoreticalAmountFcfa,
  computeVarianceFcfa,
} from '../calculations/water-reading.calculations';
import type { CreateWaterReadingDto } from './dto/create-water-reading.dto';
import type { UpdateWaterReadingDto } from './dto/update-water-reading.dto';

export interface WaterReadingWithComputed extends WaterReading {
  /** Écart informatif entre le comptage de caisse de ce relevé et le total
   * des ventes Sale(EAU) enregistrées pour le même point/jour — voir plan
   * Phase 6, section C. Purement indicatif, jamais bloquant. */
  salesCashGapFcfa: number;
}

@Injectable()
export class WaterReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly waterPointsService: WaterPointsService,
  ) {}

  private async assertWaterPointAccessible(actingUser: AccessTokenPayload, waterPointId: string) {
    return this.waterPointsService.findOne(actingUser, waterPointId);
  }

  private async attachComputedFields(reading: WaterReading): Promise<WaterReadingWithComputed> {
    const dayStart = new Date(reading.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const salesAgg = await this.prisma.sale.aggregate({
      where: {
        waterPointId: reading.waterPointId,
        productType: 'EAU',
        date: { gte: dayStart, lt: dayEnd },
      },
      _sum: { netAmountFcfa: true },
    });
    const salesCashGapFcfa = computeSalesCashGapFcfa(
      reading.cashAmountFcfa,
      salesAgg._sum.netAmountFcfa ?? 0,
    );
    return { ...reading, salesCashGapFcfa };
  }

  async findAll(
    actingUser: AccessTokenPayload,
    waterPointId: string,
  ): Promise<WaterReadingWithComputed[]> {
    await this.assertWaterPointAccessible(actingUser, waterPointId);
    const readings = await this.prisma.waterReading.findMany({
      where: { waterPointId },
      orderBy: { date: 'asc' },
    });
    return Promise.all(readings.map((reading) => this.attachComputedFields(reading)));
  }

  async findOne(
    actingUser: AccessTokenPayload,
    waterPointId: string,
    dateParam: string,
  ): Promise<WaterReadingWithComputed> {
    await this.assertWaterPointAccessible(actingUser, waterPointId);
    const reading = await this.prisma.waterReading.findUnique({
      where: { waterPointId_date: { waterPointId, date: new Date(dateParam) } },
    });
    if (!reading) {
      throw new NotFoundException('Relevé introuvable.');
    }
    return this.attachComputedFields(reading);
  }

  /**
   * §7.3 — trois contrôles distincts (voir plan Phase 6, section B) :
   * (1) indexSoir < indexMatin sans indexAnomalyReason -> 400 (intra-ligne).
   * (2) indexMatin != dernier indexSoir validé du point sans
   *     indexAnomalyReason -> 409 (conflit avec un enregistrement séparé
   *     déjà persisté, comme LayerDailyRecordsService.update()).
   * (3) écart théorique/encaissé sans remarks non vide -> 400 (intra-ligne).
   */
  async create(
    actingUser: AccessTokenPayload,
    waterPointId: string,
    dto: CreateWaterReadingDto,
    ipAddress: string | null,
  ): Promise<WaterReadingWithComputed> {
    const waterPoint = await this.assertWaterPointAccessible(actingUser, waterPointId);

    const lastReading = await this.prisma.waterReading.findFirst({
      where: { waterPointId },
      orderBy: { date: 'desc' },
    });
    const expectedIndexMatin = lastReading
      ? Number(lastReading.indexSoir)
      : Number(waterPoint.initialIndex);

    if (dto.indexMatin !== expectedIndexMatin && !dto.indexAnomalyReason) {
      throw new ConflictException(
        `Index du matin (${dto.indexMatin}) différent du dernier index validé de ce point (${expectedIndexMatin}) — indexAnomalyReason requis pour documenter l'écart.`,
      );
    }

    const isSoirLowerThanMatin = dto.indexSoir < dto.indexMatin;
    if (isSoirLowerThanMatin && !dto.indexAnomalyReason) {
      throw new BadRequestException(
        "Index soir inférieur à l'index matin : indexAnomalyReason requis pour documenter la correction.",
      );
    }
    // dto.consumptionM3 déjà garanti fourni dans ce cas par le DTO (@ValidateIf).
    const consumptionM3 = isSoirLowerThanMatin
      ? dto.consumptionM3!
      : computeConsumptionM3(dto.indexSoir, dto.indexMatin);

    const theoreticalAmountFcfa = computeTheoreticalAmountFcfa(
      consumptionM3,
      waterPoint.tariffFcfaPerM3,
    );
    const varianceFcfa = computeVarianceFcfa(dto.cashAmountFcfa, theoreticalAmountFcfa);
    if (varianceFcfa !== 0 && !dto.remarks?.trim()) {
      throw new BadRequestException(
        `Écart entre montant théorique (${theoreticalAmountFcfa} FCFA) et encaissé (${dto.cashAmountFcfa} FCFA) : remarks requis pour le justifier.`,
      );
    }

    let reading: WaterReading;
    try {
      reading = await this.prisma.waterReading.create({
        data: {
          farmId: actingUser.farmId,
          waterPointId,
          date: new Date(dto.date),
          operatorId: actingUser.sub,
          indexMatin: dto.indexMatin,
          indexSoir: dto.indexSoir,
          consumptionM3,
          tariffFcfaPerM3Snapshot: waterPoint.tariffFcfaPerM3,
          theoreticalAmountFcfa,
          cashAmountFcfa: dto.cashAmountFcfa,
          varianceFcfa,
          indexAnomalyReason: dto.indexAnomalyReason,
          remarks: dto.remarks,
          createdBy: actingUser.sub,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un relevé existe déjà pour cette date sur ce point d’eau.');
      }
      throw error;
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'water_reading',
      entityId: reading.id,
      action: 'WATER_READING_CREATED',
      newValues: {
        indexMatin: dto.indexMatin,
        indexSoir: dto.indexSoir,
        consumptionM3,
        theoreticalAmountFcfa,
        cashAmountFcfa: dto.cashAmountFcfa,
        varianceFcfa,
      },
      ipAddress,
    });

    return this.attachComputedFields(reading);
  }

  /**
   * Correction d'une journée déjà saisie (§7.3 : "une correction d'index
   * doit être auditée"). Re-vérifie (1) et (3) sur les valeurs fusionnées ;
   * (2) n'est PAS re-vérifié ici (continuité contre la journée précédente
   * précise, pas seulement "la plus récente") — même simplification que
   * DailyRecordsService.update() côté reproducteurs, qui ne revalide pas
   * non plus l'intégralité des règles de création.
   */
  async update(
    actingUser: AccessTokenPayload,
    waterPointId: string,
    dateParam: string,
    dto: UpdateWaterReadingDto,
    ipAddress: string | null,
  ): Promise<WaterReadingWithComputed> {
    const existing = await this.findOne(actingUser, waterPointId, dateParam);

    const mergedIndexMatin = dto.indexMatin ?? Number(existing.indexMatin);
    const mergedIndexSoir = dto.indexSoir ?? Number(existing.indexSoir);
    const mergedAnomalyReason = dto.indexAnomalyReason ?? existing.indexAnomalyReason ?? undefined;
    const isSoirLowerThanMatin = mergedIndexSoir < mergedIndexMatin;

    if (isSoirLowerThanMatin && !mergedAnomalyReason) {
      throw new BadRequestException(
        "Index soir inférieur à l'index matin : indexAnomalyReason requis pour documenter la correction.",
      );
    }

    let consumptionM3: number;
    if (isSoirLowerThanMatin) {
      if (dto.consumptionM3 !== undefined) {
        consumptionM3 = dto.consumptionM3;
      } else if (dto.indexMatin === undefined && dto.indexSoir === undefined) {
        consumptionM3 = Number(existing.consumptionM3);
      } else {
        throw new BadRequestException(
          "consumptionM3 requis pour documenter cette anomalie d'index.",
        );
      }
    } else {
      consumptionM3 = computeConsumptionM3(mergedIndexSoir, mergedIndexMatin);
    }

    const theoreticalAmountFcfa = computeTheoreticalAmountFcfa(
      consumptionM3,
      existing.tariffFcfaPerM3Snapshot,
    );
    const cashAmountFcfa = dto.cashAmountFcfa ?? existing.cashAmountFcfa;
    const varianceFcfa = computeVarianceFcfa(cashAmountFcfa, theoreticalAmountFcfa);
    const remarks = dto.remarks ?? existing.remarks ?? undefined;
    if (varianceFcfa !== 0 && !remarks?.trim()) {
      throw new BadRequestException(
        `Écart entre montant théorique (${theoreticalAmountFcfa} FCFA) et encaissé (${cashAmountFcfa} FCFA) : remarks requis pour le justifier.`,
      );
    }

    const updated = await this.prisma.waterReading.update({
      where: { waterPointId_date: { waterPointId, date: existing.date } },
      data: {
        indexMatin: mergedIndexMatin,
        indexSoir: mergedIndexSoir,
        consumptionM3,
        theoreticalAmountFcfa,
        cashAmountFcfa,
        varianceFcfa,
        indexAnomalyReason: mergedAnomalyReason,
        remarks,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'water_reading',
      entityId: existing.id,
      action: 'WATER_READING_UPDATED',
      oldValues: {
        indexMatin: existing.indexMatin,
        indexSoir: existing.indexSoir,
        consumptionM3: existing.consumptionM3,
        cashAmountFcfa: existing.cashAmountFcfa,
      },
      newValues: {
        indexMatin: mergedIndexMatin,
        indexSoir: mergedIndexSoir,
        consumptionM3,
        cashAmountFcfa,
      },
      ipAddress,
    });

    return this.attachComputedFields(updated);
  }
}
