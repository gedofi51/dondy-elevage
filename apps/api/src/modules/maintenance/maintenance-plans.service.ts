import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { MaintenancePlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import type { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';

/**
 * Donnée de référence (comme WaterPoint/Item) — suppression définitive
 * avec garde-fou dès l'origine, jamais de deletedAt. La première tâche est
 * créée dans la même transaction que le plan (dueDate=startDate
 * directement, pas de calcul) — les tâches suivantes sont générées à la
 * demande par MaintenanceTaskGenerationService, voir
 * DETTE_TECHNIQUE.md Phase 17, décision C.1.
 */
@Injectable()
export class MaintenancePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async assertAssetEligible(farmId: string, assetId: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.farmId !== farmId) {
      throw new NotFoundException('Actif introuvable.');
    }
    if (asset.status === 'REFORME') {
      throw new ConflictException('Impossible de planifier une maintenance sur un actif réformé.');
    }
  }

  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<MaintenancePlan> {
    const plan = await this.prisma.maintenancePlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan de maintenance introuvable.');
    }
    assertSameFarm(actingUser, plan.farmId);
    return plan;
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateMaintenancePlanDto,
    ipAddress: string | null,
  ): Promise<MaintenancePlan> {
    await this.assertAssetEligible(actingUser.farmId, dto.assetId);
    const startDate = new Date(dto.startDate);

    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenancePlan.create({
        data: {
          farmId: actingUser.farmId,
          assetId: dto.assetId,
          designation: dto.designation,
          periodicityDays: dto.periodicityDays,
          startDate,
          observations: dto.observations,
          createdBy: actingUser.sub,
        },
      });
      await tx.maintenanceTask.create({
        data: {
          farmId: actingUser.farmId,
          assetId: dto.assetId,
          planId: created.id,
          type: 'PREVENTIVE',
          designation: dto.designation,
          dueDate: startDate,
          createdBy: actingUser.sub,
        },
      });
      return created;
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_plan',
      entityId: plan.id,
      action: 'MAINTENANCE_PLAN_CREATED',
      newValues: {
        assetId: dto.assetId,
        designation: dto.designation,
        periodicityDays: dto.periodicityDays,
      },
      ipAddress,
    });

    return plan;
  }

  async findAll(actingUser: AccessTokenPayload): Promise<MaintenancePlan[]> {
    return this.prisma.maintenancePlan.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<MaintenancePlan> {
    return this.getRaw(actingUser, id);
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateMaintenancePlanDto,
    ipAddress: string | null,
  ): Promise<MaintenancePlan> {
    const existing = await this.getRaw(actingUser, id);

    const updated = await this.prisma.maintenancePlan.update({
      where: { id },
      data: { ...dto },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_plan',
      entityId: id,
      action: 'MAINTENANCE_PLAN_UPDATED',
      oldValues: {
        designation: existing.designation,
        periodicityDays: existing.periodicityDays,
        active: existing.active,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }

  /** Suppression définitive — uniquement si aucune intervention réelle
   * n'est rattachée à l'une des tâches du plan (garde-fou sur l'activité
   * réelle, même gabarit que AssetsService.remove()). Les tâches
   * placeholder sans intervention sont supprimées en cascade avec le
   * plan. */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.getRaw(actingUser, id);

    const interventionCount = await this.prisma.maintenanceIntervention.count({
      where: { task: { planId: id } },
    });
    if (interventionCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer un plan de maintenance avec des interventions enregistrées.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.maintenanceTask.deleteMany({ where: { planId: id } }),
      this.prisma.maintenancePlan.delete({ where: { id } }),
    ]);

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_plan',
      entityId: id,
      action: 'MAINTENANCE_PLAN_DELETED',
      oldValues: { designation: existing.designation, assetId: existing.assetId },
      ipAddress,
    });
  }
}
