import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type NetworkStatusReading } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import type { CreateNetworkStatusReadingDto } from './dto/create-network-status-reading.dto';
import type { UpdateNetworkStatusReadingDto } from './dto/update-network-status-reading.dto';

/**
 * Relevé de statut réseau (cahier V6 §6) — inventaire/coût déjà couverts
 * par Asset/Expense (catégorie "internet"), cette table n'ajoute QUE le
 * suivi du statut opérationnel. operationalStatus est requis (seul champ
 * de mesure de ce domaine, contrairement à eau/solaire). Pas de DELETE
 * exposé. Voir DETTE_TECHNIQUE.md Phase 18.
 */
@Injectable()
export class NetworkStatusReadingsService {
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

  async findAll(actingUser: AccessTokenPayload, assetId: string): Promise<NetworkStatusReading[]> {
    await this.assertAssetEligible(actingUser, assetId);
    return this.prisma.networkStatusReading.findMany({
      where: { assetId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    assetId: string,
    dateParam: string,
  ): Promise<NetworkStatusReading> {
    await this.assertAssetEligible(actingUser, assetId);
    const reading = await this.prisma.networkStatusReading.findUnique({
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
    dto: CreateNetworkStatusReadingDto,
    ipAddress: string | null,
  ): Promise<NetworkStatusReading> {
    await this.assertAssetEligible(actingUser, assetId);

    let reading: NetworkStatusReading;
    try {
      reading = await this.prisma.networkStatusReading.create({
        data: {
          farmId: actingUser.farmId,
          assetId,
          date: new Date(dto.date),
          operationalStatus: dto.operationalStatus,
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
      entityType: 'network_status_reading',
      entityId: reading.id,
      action: 'NETWORK_STATUS_READING_CREATED',
      newValues: { date: dto.date, operationalStatus: dto.operationalStatus },
      ipAddress,
    });

    return reading;
  }

  async update(
    actingUser: AccessTokenPayload,
    assetId: string,
    dateParam: string,
    dto: UpdateNetworkStatusReadingDto,
    ipAddress: string | null,
  ): Promise<NetworkStatusReading> {
    const existing = await this.findOne(actingUser, assetId, dateParam);

    const updated = await this.prisma.networkStatusReading.update({
      where: { assetId_date: { assetId, date: existing.date } },
      data: { ...dto },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'network_status_reading',
      entityId: existing.id,
      action: 'NETWORK_STATUS_READING_UPDATED',
      oldValues: { operationalStatus: existing.operationalStatus },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
