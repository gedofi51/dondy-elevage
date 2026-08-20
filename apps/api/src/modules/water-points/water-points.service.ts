import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type WaterPoint } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateWaterPointDto } from './dto/create-water-point.dto';
import type { UpdateWaterPointDto } from './dto/update-water-point.dto';

const CODE_PREFIX = 'EAU-';
const CODE_DIGITS = 3;
const MAX_CODE_RETRIES = 3;

/** Donnée de référence permanente (comme Customer/Supplier) : code plat
 * EAU-NNN, PAS année-scopé (contrairement aux codes de bande — un point
 * d'eau n'est pas un cycle répété). */
@Injectable()
export class WaterPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async generateCode(farmId: string): Promise<string> {
    const last = await this.prisma.waterPoint.findFirst({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${CODE_PREFIX}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  private async assertResponsibleBelongsToFarm(
    farmId: string,
    responsibleId: string,
  ): Promise<void> {
    const responsible = await this.prisma.user.findUnique({ where: { id: responsibleId } });
    if (!responsible || responsible.farmId !== farmId) {
      throw new NotFoundException('Responsable introuvable.');
    }
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateWaterPointDto,
    ipAddress: string | null,
  ): Promise<WaterPoint> {
    await this.assertResponsibleBelongsToFarm(actingUser.farmId, dto.responsibleId);

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateCode(actingUser.farmId);
      try {
        const waterPoint = await this.prisma.waterPoint.create({
          data: {
            farmId: actingUser.farmId,
            code,
            name: dto.name,
            location: dto.location,
            meterReference: dto.meterReference,
            initialIndex: dto.initialIndex,
            tariffFcfaPerM3: dto.tariffFcfaPerM3,
            responsibleId: dto.responsibleId,
            createdBy: actingUser.sub,
          },
        });
        await this.auditLogService.record({
          farmId: actingUser.farmId,
          userId: actingUser.sub,
          entityType: 'water_point',
          entityId: waterPoint.id,
          action: 'WATER_POINT_CREATED',
          newValues: { code, name: dto.name, tariffFcfaPerM3: dto.tariffFcfaPerM3 },
          ipAddress,
        });
        return waterPoint;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException("Impossible de générer un code de point d'eau unique — réessayer.");
  }

  async findAll(actingUser: AccessTokenPayload): Promise<WaterPoint[]> {
    return this.prisma.waterPoint.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<WaterPoint> {
    const waterPoint = await this.prisma.waterPoint.findUnique({ where: { id } });
    if (!waterPoint) {
      throw new NotFoundException("Point d'eau introuvable.");
    }
    assertSameFarm(actingUser, waterPoint.farmId);
    return waterPoint;
  }

  /** Usage interne (SalesService, WaterReadingsService) : lève 404 si hors
   * farm, sans passer par le contrôleur. */
  async findRawForFarm(farmId: string, id: string): Promise<WaterPoint> {
    const waterPoint = await this.prisma.waterPoint.findUnique({ where: { id } });
    if (!waterPoint || waterPoint.farmId !== farmId) {
      throw new NotFoundException("Point d'eau introuvable.");
    }
    return waterPoint;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateWaterPointDto,
    ipAddress: string | null,
  ): Promise<WaterPoint> {
    const existing = await this.findOne(actingUser, id);
    if (dto.responsibleId) {
      await this.assertResponsibleBelongsToFarm(actingUser.farmId, dto.responsibleId);
    }
    if (dto.initialIndex !== undefined) {
      const readingCount = await this.prisma.waterReading.count({ where: { waterPointId: id } });
      if (readingCount > 0) {
        throw new ConflictException(
          "Impossible de modifier l'index initial : des relevés existent déjà pour ce point d'eau.",
        );
      }
    }

    const updated = await this.prisma.waterPoint.update({ where: { id }, data: dto });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'water_point',
      entityId: id,
      action: 'WATER_POINT_UPDATED',
      oldValues: {
        name: existing.name,
        tariffFcfaPerM3: existing.tariffFcfaPerM3,
        status: existing.status,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }

  /** Suppression définitive — uniquement si aucun relevé ni aucune vente
   * n'est lié (contrairement à Building/Incubator/Supplier, dont le
   * remove() actuel n'a aucun garde-fou réel — angle mort pré-existant,
   * signalé dans DETTE_TECHNIQUE.md, évité ici puisque ce point est créé
   * dans cette même phase). Dans tous les autres cas : PATCH status. */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);

    const [readingCount, saleCount] = await Promise.all([
      this.prisma.waterReading.count({ where: { waterPointId: id } }),
      this.prisma.sale.count({ where: { waterPointId: id } }),
    ]);
    if (readingCount > 0 || saleCount > 0) {
      throw new ConflictException(
        "Impossible de supprimer un point d'eau avec des relevés ou des ventes enregistrés — utiliser le statut (SUSPENDU/MAINTENANCE).",
      );
    }

    await this.prisma.waterPoint.delete({ where: { id } });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'water_point',
      entityId: id,
      action: 'WATER_POINT_DELETED',
      oldValues: { code: existing.code, name: existing.name },
      ipAddress,
    });
  }
}
