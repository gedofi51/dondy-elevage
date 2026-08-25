import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SolarInfrastructureReading } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import type { CreateSolarInfrastructureReadingDto } from './dto/create-solar-infrastructure-reading.dto';
import type { UpdateSolarInfrastructureReadingDto } from './dto/update-solar-infrastructure-reading.dto';

/**
 * Relevé d'infrastructure solaire (cahier V6 §4) — même gabarit que
 * WaterInfrastructureReadingsService : pas de DELETE exposé, garde
 * d'unicité via P2002. Pas d'équation de contrôle pour ce domaine (le
 * cahier n'en donne aucune, contrairement à l'eau §5). Voir
 * DETTE_TECHNIQUE.md Phase 18.
 */
@Injectable()
export class SolarInfrastructureReadingsService {
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

  async findAll(
    actingUser: AccessTokenPayload,
    assetId: string,
  ): Promise<SolarInfrastructureReading[]> {
    await this.assertAssetEligible(actingUser, assetId);
    return this.prisma.solarInfrastructureReading.findMany({
      where: { assetId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    assetId: string,
    dateParam: string,
  ): Promise<SolarInfrastructureReading> {
    await this.assertAssetEligible(actingUser, assetId);
    const reading = await this.prisma.solarInfrastructureReading.findUnique({
      where: { assetId_date: { assetId, date: new Date(dateParam) } },
    });
    if (!reading) {
      throw new NotFoundException('Relevé introuvable.');
    }
    return reading;
  }

  async create(
    actingUser: AccessTokenPayload,
    assetId: string,
    dto: CreateSolarInfrastructureReadingDto,
    ipAddress: string | null,
  ): Promise<SolarInfrastructureReading> {
    await this.assertAssetEligible(actingUser, assetId);

    if (
      dto.dailyProductionKwh === undefined &&
      dto.batteryChargePercent === undefined &&
      dto.instantaneousPowerKw === undefined
    ) {
      throw new BadRequestException('Au moins une mesure doit être renseignée.');
    }

    let reading: SolarInfrastructureReading;
    try {
      reading = await this.prisma.solarInfrastructureReading.create({
        data: {
          farmId: actingUser.farmId,
          assetId,
          date: new Date(dto.date),
          dailyProductionKwh: dto.dailyProductionKwh,
          batteryChargePercent: dto.batteryChargePercent,
          instantaneousPowerKw: dto.instantaneousPowerKw,
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
      entityType: 'solar_infrastructure_reading',
      entityId: reading.id,
      action: 'SOLAR_INFRASTRUCTURE_READING_CREATED',
      newValues: { date: dto.date, batteryChargePercent: dto.batteryChargePercent },
      ipAddress,
    });

    return reading;
  }

  async update(
    actingUser: AccessTokenPayload,
    assetId: string,
    dateParam: string,
    dto: UpdateSolarInfrastructureReadingDto,
    ipAddress: string | null,
  ): Promise<SolarInfrastructureReading> {
    const existing = await this.findOne(actingUser, assetId, dateParam);

    const updated = await this.prisma.solarInfrastructureReading.update({
      where: { assetId_date: { assetId, date: existing.date } },
      data: { ...dto },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'solar_infrastructure_reading',
      entityId: existing.id,
      action: 'SOLAR_INFRASTRUCTURE_READING_UPDATED',
      oldValues: { batteryChargePercent: existing.batteryChargePercent },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
