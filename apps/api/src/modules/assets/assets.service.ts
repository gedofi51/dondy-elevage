import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Asset, DepreciationEntry } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  computeDepreciationSchedule,
  computeTotalAcquisitionCostFcfa,
  findCurrentDepreciationEntry,
} from './calculations/depreciation.calculations';
import type { CreateAssetDto } from './dto/create-asset.dto';
import type { UpdateAssetDto } from './dto/update-asset.dto';
import type { ReformAssetDto } from './dto/reform-asset.dto';

const CODE_PREFIX_BASE = 'PAT';
const CODE_DIGITS = 3;
const MAX_CODE_RETRIES = 3;

export interface AssetWithComputed extends Asset {
  totalAcquisitionCostFcfa: number;
  accumulatedDepreciationFcfa: number;
  netBookValueFcfa: number;
  tcoFcfa: number;
}

/** Donnée de référence à activité financière (comme WaterPoint/Item) —
 * suppression définitive avec garde-fou dès l'origine, jamais de
 * deletedAt. Le plan d'amortissement (DepreciationEntry) est généré
 * atomiquement à la création, jamais recalculé après coup — voir
 * calculations/depreciation.calculations.ts pour les hypothèses
 * documentées (prorata temporis, calendrier fiscal). */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Dérivé du dernier code émis (jamais d'un COUNT(*), voir CustomersService).
   * Année = année d'achat (comme PurchaseOrder : année du champ métier de
   * l'entité, pas la date système). */
  private async generateCode(farmId: string, year: number): Promise<string> {
    const prefix = `${CODE_PREFIX_BASE}-${year}-`;
    const last = await this.prisma.asset.findFirst({
      where: { farmId, code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  private async assertSupplierBelongsToFarm(farmId: string, supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || supplier.farmId !== farmId) {
      throw new NotFoundException('Fournisseur introuvable.');
    }
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

  private async getRaw(actingUser: AccessTokenPayload, id: string): Promise<Asset> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException('Actif introuvable.');
    }
    assertSameFarm(actingUser, asset.farmId);
    return asset;
  }

  /** accumulatedDepreciationFcfa/netBookValueFcfa : dérivés à la lecture
   * depuis la dernière DepreciationEntry déjà écoulée (jamais recalculés
   * indépendamment du plan déjà généré) — plafonnés au reformDate une
   * fois l'actif réformé. tcoFcfa : partiel cette phase (Maintenance,
   * Phase 17, n'existe pas encore), voir DETTE_TECHNIQUE.md. */
  private async attachComputed(asset: Asset): Promise<AssetWithComputed> {
    const entries = await this.prisma.depreciationEntry.findMany({
      where: { assetId: asset.id },
      orderBy: { periodNumber: 'asc' },
    });
    const asOfDate = asset.reformDate ?? new Date();
    const current = findCurrentDepreciationEntry(entries, asOfDate);
    const totalAcquisitionCostFcfa = computeTotalAcquisitionCostFcfa(
      asset.purchasePriceFcfa,
      asset.installationCostFcfa,
    );
    const accumulatedDepreciationFcfa = current?.cumulativeFcfa ?? 0;
    const netBookValueFcfa = current?.netBookValueFcfa ?? totalAcquisitionCostFcfa;

    const additionalCosts = await this.prisma.expense.aggregate({
      where: { assetId: asset.id, deletedAt: null },
      _sum: { amountFcfa: true },
    });
    const tcoFcfa = totalAcquisitionCostFcfa + (additionalCosts._sum.amountFcfa ?? 0);

    return {
      ...asset,
      totalAcquisitionCostFcfa,
      accumulatedDepreciationFcfa,
      netBookValueFcfa,
      tcoFcfa,
    };
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateAssetDto,
    ipAddress: string | null,
  ): Promise<AssetWithComputed> {
    if (dto.supplierId) {
      await this.assertSupplierBelongsToFarm(actingUser.farmId, dto.supplierId);
    }
    await this.assertResponsibleBelongsToFarm(actingUser.farmId, dto.responsibleId);

    const purchaseDate = new Date(dto.purchaseDate);
    const serviceDate = new Date(dto.serviceDate);
    if (serviceDate.getTime() < purchaseDate.getTime()) {
      throw new BadRequestException(
        'La date de mise en service ne peut pas précéder la date d’achat.',
      );
    }

    const installationCostFcfa = dto.installationCostFcfa ?? 0;
    const residualValueFcfa = dto.residualValueFcfa ?? 0;
    const acquisitionCostFcfa = computeTotalAcquisitionCostFcfa(
      dto.purchasePriceFcfa,
      installationCostFcfa,
    );
    if (residualValueFcfa >= acquisitionCostFcfa) {
      throw new BadRequestException(
        'La valeur résiduelle doit être strictement inférieure au coût d’acquisition total.',
      );
    }

    const scheduleLines = computeDepreciationSchedule(
      acquisitionCostFcfa,
      residualValueFcfa,
      serviceDate,
      dto.depreciationDurationYears,
    );

    let asset: Asset | undefined;
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateCode(actingUser.farmId, purchaseDate.getFullYear());
      try {
        asset = await this.prisma.$transaction(async (tx) => {
          const created = await tx.asset.create({
            data: {
              farmId: actingUser.farmId,
              code,
              designation: dto.designation,
              category: dto.category,
              brand: dto.brand,
              model: dto.model,
              serialNumber: dto.serialNumber,
              supplierId: dto.supplierId,
              purchaseDate,
              serviceDate,
              purchasePriceFcfa: dto.purchasePriceFcfa,
              installationCostFcfa,
              location: dto.location,
              responsibleId: dto.responsibleId,
              warrantyExpiresAt: dto.warrantyExpiresAt
                ? new Date(dto.warrantyExpiresAt)
                : undefined,
              residualValueFcfa,
              depreciationDurationYears: dto.depreciationDurationYears,
              observations: dto.observations,
              createdBy: actingUser.sub,
            },
          });
          if (scheduleLines.length > 0) {
            await tx.depreciationEntry.createMany({
              data: scheduleLines.map((line) => ({
                farmId: actingUser.farmId,
                assetId: created.id,
                periodNumber: line.periodNumber,
                periodStart: line.periodStart,
                periodEnd: line.periodEnd,
                dotationFcfa: line.dotationFcfa,
                cumulativeFcfa: line.cumulativeFcfa,
                netBookValueFcfa: line.netBookValueFcfa,
              })),
            });
          }
          return created;
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }
    if (!asset) {
      throw new ConflictException('Impossible de générer un code d’actif unique — réessayer.');
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'asset',
      entityId: asset.id,
      action: 'ASSET_CREATED',
      newValues: { code: asset.code, designation: dto.designation, category: dto.category },
      ipAddress,
    });

    return this.attachComputed(asset);
  }

  async findAll(actingUser: AccessTokenPayload): Promise<AssetWithComputed[]> {
    const assets = await this.prisma.asset.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(assets.map((asset) => this.attachComputed(asset)));
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<AssetWithComputed> {
    const asset = await this.getRaw(actingUser, id);
    return this.attachComputed(asset);
  }

  async listDepreciationEntries(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<DepreciationEntry[]> {
    await this.getRaw(actingUser, id);
    return this.prisma.depreciationEntry.findMany({
      where: { assetId: id },
      orderBy: { periodNumber: 'asc' },
    });
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateAssetDto,
    ipAddress: string | null,
  ): Promise<AssetWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    if (dto.supplierId) {
      await this.assertSupplierBelongsToFarm(actingUser.farmId, dto.supplierId);
    }
    if (dto.responsibleId) {
      await this.assertResponsibleBelongsToFarm(actingUser.farmId, dto.responsibleId);
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...dto,
        warrantyExpiresAt:
          dto.warrantyExpiresAt !== undefined ? new Date(dto.warrantyExpiresAt) : undefined,
      },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'asset',
      entityId: id,
      action: 'ASSET_UPDATED',
      oldValues: {
        designation: existing.designation,
        location: existing.location,
        responsibleId: existing.responsibleId,
        status: existing.status,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return this.attachComputed(updated);
  }

  /** Suppression définitive — uniquement si aucune dépense n'est rattachée
   * (garde-fou explicite dès l'origine, comme WaterPointsService/
   * ItemsService.remove()). Contrairement à StockMovement, les
   * DepreciationEntry pré-générées ne sont pas une activité réelle
   * indépendante — supprimées en cascade avec l'actif, même gabarit que
   * BroilerBatchesService.remove() pour ses 45 lignes placeholder (voir
   * DETTE_TECHNIQUE.md Phase 16, décision C.4). */
  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.getRaw(actingUser, id);

    const expenseCount = await this.prisma.expense.count({
      where: { assetId: id, deletedAt: null },
    });
    if (expenseCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer un actif avec des dépenses enregistrées — utiliser la réforme (POST /:id/reformer).',
      );
    }

    // Phase 17 — MaintenancePlan/MaintenanceTask/MaintenanceIntervention
    // référencent assetId en ON DELETE RESTRICT (voir schema.prisma) :
    // garde explicite ici pour un 409 propre plutôt qu'une erreur SQL
    // brute non gérée.
    const maintenanceCount = await this.prisma.maintenanceTask.count({ where: { assetId: id } });
    const interventionCount = await this.prisma.maintenanceIntervention.count({
      where: { assetId: id },
    });
    if (maintenanceCount > 0 || interventionCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer un actif avec un historique de maintenance — utiliser la réforme (POST /:id/reformer).',
      );
    }

    // Phase 18 — WaterInfrastructureReading/SolarInfrastructureReading/
    // NetworkStatusReading référencent aussi assetId en ON DELETE
    // RESTRICT — même garde explicite pour un 409 propre.
    const [waterReadingCount, solarReadingCount, networkReadingCount] = await Promise.all([
      this.prisma.waterInfrastructureReading.count({ where: { assetId: id } }),
      this.prisma.solarInfrastructureReading.count({ where: { assetId: id } }),
      this.prisma.networkStatusReading.count({ where: { assetId: id } }),
    ]);
    if (waterReadingCount > 0 || solarReadingCount > 0 || networkReadingCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer un actif avec des relevés d’infrastructure enregistrés — utiliser la réforme (POST /:id/reformer).',
      );
    }

    await this.prisma.$transaction([
      this.prisma.depreciationEntry.deleteMany({ where: { assetId: id } }),
      this.prisma.asset.delete({ where: { id } }),
    ]);

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'asset',
      entityId: id,
      action: 'ASSET_DELETED',
      oldValues: { code: existing.code, designation: existing.designation },
      ipAddress,
    });
  }

  /** Statut terminal — seul chemin vers REFORME (voir UpdateAssetDto qui
   * l'exclut explicitement). Le calcul de VNC/amortissement cumulé à la
   * lecture (attachComputed) plafonne au reformDate une fois réformé ;
   * les DepreciationEntry post-réforme restent en base, jamais
   * supprimées (principe "jamais de suppression d'historique déjà
   * généré"). */
  async reform(
    actingUser: AccessTokenPayload,
    id: string,
    dto: ReformAssetDto,
    ipAddress: string | null,
  ): Promise<AssetWithComputed> {
    const existing = await this.getRaw(actingUser, id);
    if (existing.status === 'REFORME') {
      throw new ConflictException('Cet actif est déjà réformé.');
    }

    const reformDate = dto.reformDate ? new Date(dto.reformDate) : new Date();
    const updated = await this.prisma.asset.update({
      where: { id },
      data: { status: 'REFORME', reformDate, reformReason: dto.reformReason },
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'asset',
      entityId: id,
      action: 'ASSET_REFORMED',
      oldValues: { status: existing.status },
      newValues: {
        status: 'REFORME',
        reformDate: reformDate.toISOString(),
        reformReason: dto.reformReason,
      },
      ipAddress,
    });

    return this.attachComputed(updated);
  }
}
