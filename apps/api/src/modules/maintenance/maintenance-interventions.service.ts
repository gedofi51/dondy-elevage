import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type MaintenanceIntervention } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import type {
  CreateMaintenanceInterventionDto,
  MaintenanceInterventionPartDto,
} from './dto/create-maintenance-intervention.dto';

const MAX_TRANSACTION_RETRIES = 3;

/** Même seuil que StockMovementsService/SalesService/etc. Gap
 * préexistant corrigé en Phase 20 : cette transaction verrouille déjà
 * Item (par pièce, via recordMovementInTransaction) et désormais
 * MaintenanceTask (via markRealizedInTransaction) sans aucun retry —
 * contrairement à StockMovementsService.create(), qui a ce filet depuis
 * la Phase 7 pour le même type de verrouillage. Voir
 * DETTE_TECHNIQUE.md Phase 20.
 *
 * P2034 = conflit/deadlock détecté par Prisma au niveau ORM. P2010 =
 * "Raw query failed", code générique remonté quand le deadlock survient
 * DANS un `$queryRaw` (ex. le `SELECT ... FOR UPDATE` de
 * `recordMovementInTransaction`) — le vrai code MySQL (1213 deadlock /
 * 1205 lock wait timeout) est niché dans
 * `meta.driverAdapterError.cause.originalCode`, pas exposé comme P2034.
 * Trouvé en vérification manuelle Phase 20 : deux interventions
 * concurrentes sur la même tâche ET le même article ont produit un 500
 * brut au lieu du 409 attendu sans ce second cas — voir
 * DETTE_TECHNIQUE.md. */
function isSerializationFailure(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code === 'P2034') {
    return true;
  }
  if (error.code === 'P2010') {
    const meta = error.meta as
      { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
    const originalCode = meta?.driverAdapterError?.cause?.originalCode;
    return originalCode === '1213' || originalCode === '1205';
  }
  return false;
}

export interface MaintenanceInterventionWithComputed extends MaintenanceIntervention {
  /** Dérivés à la lecture depuis les StockMovement liés
   * (sourceType='maintenance_intervention'), jamais stockés — même
   * philosophie que Asset.attachComputed(). */
  partsCostFcfa: number;
  totalCostFcfa: number;
}

/**
 * Historique réel des diagnostics/réparations (cahier V6 §7) — append-only
 * (voir schema.prisma) : pas de PATCH/DELETE exposés, une correction passe
 * par les mécanismes déjà existants (soft-delete Expense + ajustement de
 * stock), jamais par une édition en place. Chaque pièce consommée
 * réutilise StockMovementsService.recordMovementInTransaction (point
 * d'entrée unique, Phase 7) PUIS génère une Expense automatique liée à
 * l'actif — alimente le TCO déjà préparé sur Asset sans aucun changement
 * de code sur AssetsService (voir DETTE_TECHNIQUE.md Phase 17).
 */
@Injectable()
export class MaintenanceInterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly maintenanceTasksService: MaintenanceTasksService,
  ) {}

  private async attachComputed(
    intervention: MaintenanceIntervention,
  ): Promise<MaintenanceInterventionWithComputed> {
    const partsCost = await this.prisma.stockMovement.aggregate({
      where: { sourceType: 'maintenance_intervention', sourceId: intervention.id },
      _sum: { totalValueFcfa: true },
    });
    const partsCostFcfa = partsCost._sum.totalValueFcfa ?? 0;
    return {
      ...intervention,
      partsCostFcfa,
      totalCostFcfa: intervention.laborCostFcfa + partsCostFcfa,
    };
  }

  private async getRaw(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<MaintenanceIntervention> {
    const intervention = await this.prisma.maintenanceIntervention.findUnique({ where: { id } });
    if (!intervention) {
      throw new NotFoundException('Intervention de maintenance introuvable.');
    }
    assertSameFarm(actingUser, intervention.farmId);
    return intervention;
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateMaintenanceInterventionDto,
    ipAddress: string | null,
  ): Promise<MaintenanceInterventionWithComputed> {
    const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
    if (!asset || asset.farmId !== actingUser.farmId) {
      throw new NotFoundException('Actif introuvable.');
    }
    if (asset.status === 'REFORME') {
      throw new ConflictException(
        'Impossible d’enregistrer une intervention sur un actif réformé.',
      );
    }

    if (dto.taskId) {
      const task = await this.prisma.maintenanceTask.findUnique({ where: { id: dto.taskId } });
      if (!task || task.farmId !== actingUser.farmId || task.assetId !== dto.assetId) {
        throw new NotFoundException('Tâche de maintenance introuvable.');
      }
    }

    const interventionDate = new Date(dto.interventionDate);
    const laborCostFcfa = dto.laborCostFcfa ?? 0;
    const parts = dto.parts ?? [];

    let intervention: MaintenanceIntervention | undefined;
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        intervention = await this.runCreateTransaction(
          actingUser,
          dto,
          interventionDate,
          laborCostFcfa,
          parts,
        );
        break;
      } catch (error) {
        if (
          error instanceof ConflictException ||
          error instanceof BadRequestException ||
          error instanceof NotFoundException
        ) {
          throw error;
        }
        if (isSerializationFailure(error) && attempt < MAX_TRANSACTION_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    // intervention est garanti défini ici : la boucle se termine soit par
    // `break` après une affectation réussie, soit par un `throw`.
    const finalIntervention = intervention!;

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'maintenance_intervention',
      entityId: finalIntervention.id,
      action: 'MAINTENANCE_INTERVENTION_CREATED',
      newValues: {
        assetId: dto.assetId,
        taskId: dto.taskId ?? null,
        laborCostFcfa,
        partsCount: parts.length,
      },
      ipAddress,
    });

    return this.attachComputed(finalIntervention);
  }

  private async runCreateTransaction(
    actingUser: AccessTokenPayload,
    dto: CreateMaintenanceInterventionDto,
    interventionDate: Date,
    laborCostFcfa: number,
    parts: MaintenanceInterventionPartDto[],
  ): Promise<MaintenanceIntervention> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceIntervention.create({
        data: {
          farmId: actingUser.farmId,
          assetId: dto.assetId,
          taskId: dto.taskId,
          interventionDate,
          diagnosis: dto.diagnosis,
          laborCostFcfa,
          performedBy: dto.performedBy,
          createdBy: actingUser.sub,
        },
      });

      for (const part of parts) {
        const movement = await this.stockMovementsService.recordMovementInTransaction(tx, {
          farmId: actingUser.farmId,
          itemId: part.itemId,
          type: 'SORTIE',
          reason: 'MAINTENANCE',
          quantity: part.quantity,
          date: interventionDate,
          createdBy: actingUser.sub,
          sourceType: 'maintenance_intervention',
          sourceId: created.id,
        });
        await tx.expense.create({
          data: {
            farmId: actingUser.farmId,
            assetId: dto.assetId,
            date: interventionDate,
            category: 'Pièces maintenance',
            description: `Pièce utilisée — intervention ${created.id}`,
            quantity: movement.quantity,
            unitPriceFcfa: movement.unitCostFcfaSnapshot,
            amountFcfa: movement.totalValueFcfa,
            createdBy: actingUser.sub,
          },
        });
      }

      if (laborCostFcfa > 0) {
        await tx.expense.create({
          data: {
            farmId: actingUser.farmId,
            assetId: dto.assetId,
            date: interventionDate,
            category: "Main-d'œuvre maintenance",
            description: `Main-d'œuvre — intervention ${created.id}`,
            amountFcfa: laborCostFcfa,
            createdBy: actingUser.sub,
          },
        });
      }

      if (dto.taskId) {
        await this.maintenanceTasksService.markRealizedInTransaction(tx, dto.taskId);
      }

      return created;
    });
  }

  async findAll(actingUser: AccessTokenPayload): Promise<MaintenanceInterventionWithComputed[]> {
    const interventions = await this.prisma.maintenanceIntervention.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { interventionDate: 'desc' },
    });
    return Promise.all(interventions.map((intervention) => this.attachComputed(intervention)));
  }

  async findOne(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<MaintenanceInterventionWithComputed> {
    return this.attachComputed(await this.getRaw(actingUser, id));
  }
}
