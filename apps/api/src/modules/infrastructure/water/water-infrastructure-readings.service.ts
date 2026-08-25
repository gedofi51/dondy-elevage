import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type WaterInfrastructureReading } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { computeWaterControlGapM3 } from '../calculations/water-control-equation.calculations';
import type { CreateWaterInfrastructureReadingDto } from './dto/create-water-infrastructure-reading.dto';
import type { UpdateWaterInfrastructureReadingDto } from './dto/update-water-infrastructure-reading.dto';

export interface WaterInfrastructureReadingWithComputed extends WaterInfrastructureReading {
  /** Équation de contrôle V6 §5 — dérivés à la lecture, jamais stockés.
   * gapM3 = null si pumpedVolumeM3 absent (équation non calculable). */
  soldVolumeM3: number;
  gapM3: number | null;
}

/**
 * Relevé d'infrastructure de PRODUCTION d'eau (forage/pompe/réservoir) —
 * à ne pas confondre avec WaterReading (module V4, vente commerciale).
 * Gabarit repris de WaterReadingsService : pas de DELETE exposé, garde
 * d'unicité via P2002, champ dérivé jamais stocké. Voir
 * DETTE_TECHNIQUE.md Phase 18.
 */
@Injectable()
export class WaterInfrastructureReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async assertAssetEligible(
    actingUser: AccessTokenPayload,
    assetId: string,
  ): Promise<void> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('Actif introuvable.');
    }
    assertSameFarm(actingUser, asset.farmId);
    if (asset.status === 'REFORME') {
      throw new ConflictException(
        'Impossible d’enregistrer un relevé d’infrastructure sur un actif réformé.',
      );
    }
  }

  /** "Eau vendue" = SUM(WaterReading.consumptionM3) agrégé ferme entière
   * (tous les WaterPoint confondus) pour la même date — vérité métrée,
   * pas Sale (valorisation FCFA, pas un volume). Voir DETTE_TECHNIQUE.md
   * Phase 18, décision C.2. */
  private async attachComputedFields(
    reading: WaterInfrastructureReading,
  ): Promise<WaterInfrastructureReadingWithComputed> {
    const dayStart = new Date(reading.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const salesAgg = await this.prisma.waterReading.aggregate({
      where: { farmId: reading.farmId, date: { gte: dayStart, lt: dayEnd } },
      _sum: { consumptionM3: true },
    });
    const soldVolumeM3 = Number(salesAgg._sum.consumptionM3 ?? 0);
    const gapM3 = computeWaterControlGapM3(
      reading.pumpedVolumeM3 !== null ? Number(reading.pumpedVolumeM3) : null,
      reading.farmInternalConsumptionM3 !== null ? Number(reading.farmInternalConsumptionM3) : null,
      soldVolumeM3,
    );
    return { ...reading, soldVolumeM3, gapM3 };
  }

  async findAll(
    actingUser: AccessTokenPayload,
    assetId: string,
  ): Promise<WaterInfrastructureReadingWithComputed[]> {
    await this.assertAssetEligible(actingUser, assetId);
    const readings = await this.prisma.waterInfrastructureReading.findMany({
      where: { assetId },
      orderBy: { date: 'desc' },
    });
    return Promise.all(readings.map((reading) => this.attachComputedFields(reading)));
  }

  async findOne(
    actingUser: AccessTokenPayload,
    assetId: string,
    dateParam: string,
  ): Promise<WaterInfrastructureReadingWithComputed> {
    await this.assertAssetEligible(actingUser, assetId);
    const reading = await this.prisma.waterInfrastructureReading.findUnique({
      where: { assetId_date: { assetId, date: new Date(dateParam) } },
    });
    if (!reading) {
      throw new NotFoundException('Relevé introuvable.');
    }
    return this.attachComputedFields(reading);
  }

  async create(
    actingUser: AccessTokenPayload,
    assetId: string,
    dto: CreateWaterInfrastructureReadingDto,
    ipAddress: string | null,
  ): Promise<WaterInfrastructureReadingWithComputed> {
    await this.assertAssetEligible(actingUser, assetId);

    if (
      dto.pumpedVolumeM3 === undefined &&
      dto.reservoirLevelPercent === undefined &&
      dto.pumpHoursCumulative === undefined &&
      dto.farmInternalConsumptionM3 === undefined
    ) {
      throw new BadRequestException('Au moins une mesure doit être renseignée.');
    }

    let reading: WaterInfrastructureReading;
    try {
      reading = await this.prisma.waterInfrastructureReading.create({
        data: {
          farmId: actingUser.farmId,
          assetId,
          date: new Date(dto.date),
          pumpedVolumeM3: dto.pumpedVolumeM3,
          reservoirLevelPercent: dto.reservoirLevelPercent,
          pumpHoursCumulative: dto.pumpHoursCumulative,
          farmInternalConsumptionM3: dto.farmInternalConsumptionM3,
          observations: dto.observations,
          createdBy: actingUser.sub,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un relevé existe déjà pour cette date sur cet actif.');
      }
      throw error;
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'water_infrastructure_reading',
      entityId: reading.id,
      action: 'WATER_INFRASTRUCTURE_READING_CREATED',
      newValues: { date: dto.date, pumpedVolumeM3: dto.pumpedVolumeM3 },
      ipAddress,
    });

    return this.attachComputedFields(reading);
  }

  async update(
    actingUser: AccessTokenPayload,
    assetId: string,
    dateParam: string,
    dto: UpdateWaterInfrastructureReadingDto,
    ipAddress: string | null,
  ): Promise<WaterInfrastructureReadingWithComputed> {
    const existing = await this.findOne(actingUser, assetId, dateParam);

    const updated = await this.prisma.waterInfrastructureReading.update({
      where: { assetId_date: { assetId, date: existing.date } },
      data: { ...dto },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'water_infrastructure_reading',
      entityId: existing.id,
      action: 'WATER_INFRASTRUCTURE_READING_UPDATED',
      oldValues: {
        pumpedVolumeM3: existing.pumpedVolumeM3,
        reservoirLevelPercent: existing.reservoirLevelPercent,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputedFields(updated);
  }
}
