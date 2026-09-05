import { Injectable, NotFoundException } from '@nestjs/common';
import type { Block } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateBlockDto } from './dto/create-block.dto';
import type { UpdateBlockDto } from './dto/update-block.dto';

/** Sous-unité optionnelle d'un Bâtiment (Option A, voir DETTE_TECHNIQUE.md).
 * Même patron minimal que BuildingsService — donnée de référence simple,
 * pas de champ calculé. remove() ne nécessite AUCUNE garde métier : la
 * relation blockId sur BroilerBatch/LayerBatch/BreederBatch est
 * onDelete: SetNull (voir schema.prisma) — supprimer un bloc efface juste
 * cette précision optionnelle sur les bandes qui l'utilisaient, jamais
 * bloqué, jamais de suppression en cascade. */
@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async assertBuildingBelongsToFarm(farmId: string, buildingId: string): Promise<void> {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!building || building.farmId !== farmId) {
      throw new NotFoundException('Bâtiment introuvable.');
    }
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateBlockDto,
    ipAddress: string | null,
  ): Promise<Block> {
    await this.assertBuildingBelongsToFarm(actingUser.farmId, dto.buildingId);

    const block = await this.prisma.block.create({
      data: {
        farmId: actingUser.farmId,
        buildingId: dto.buildingId,
        name: dto.name,
        code: dto.code,
        createdBy: actingUser.sub,
      },
    });
    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'block',
      entityId: block.id,
      action: 'BLOCK_CREATED',
      newValues: { name: block.name, code: block.code, buildingId: block.buildingId },
      ipAddress,
    });
    return block;
  }

  /** Pas de filtre `buildingId` en requête — même précédent que
   * MaintenanceTasksController.findAll() : retourne tous les blocs de la
   * ferme, le filtrage par bâtiment se fait côté client (voir
   * AssetDetailView pour le patron déjà en place). */
  async findAll(actingUser: AccessTokenPayload): Promise<Block[]> {
    return this.prisma.block.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Block> {
    const block = await this.prisma.block.findUnique({ where: { id } });
    if (!block) {
      throw new NotFoundException('Bloc introuvable.');
    }
    assertSameFarm(actingUser, block.farmId);
    return block;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateBlockDto,
    ipAddress: string | null,
  ): Promise<Block> {
    const existing = await this.findOne(actingUser, id);
    const updated = await this.prisma.block.update({ where: { id }, data: dto });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'block',
      entityId: id,
      action: 'BLOCK_UPDATED',
      oldValues: { name: existing.name, code: existing.code },
      newValues: { ...dto },
      ipAddress,
    });
    return updated;
  }

  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);
    await this.prisma.block.delete({ where: { id } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'block',
      entityId: id,
      action: 'BLOCK_DELETED',
      oldValues: { name: existing.name, code: existing.code },
      ipAddress,
    });
  }
}
