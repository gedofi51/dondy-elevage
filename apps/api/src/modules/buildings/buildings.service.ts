import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Building } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateBuildingDto } from './dto/create-building.dto';
import type { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateBuildingDto,
    ipAddress: string | null,
  ): Promise<Building> {
    const building = await this.prisma.building.create({
      data: { ...dto, farmId: actingUser.farmId, createdBy: actingUser.sub },
    });
    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'building',
      entityId: building.id,
      action: 'BUILDING_CREATED',
      newValues: { ...dto },
      ipAddress,
    });
    return building;
  }

  async findAll(actingUser: AccessTokenPayload): Promise<Building[]> {
    return this.prisma.building.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Building> {
    const building = await this.prisma.building.findUnique({ where: { id } });
    if (!building) {
      throw new NotFoundException('Bâtiment introuvable.');
    }
    assertSameFarm(actingUser, building.farmId);
    return building;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateBuildingDto,
    ipAddress: string | null,
  ): Promise<Building> {
    const existing = await this.findOne(actingUser, id);
    const updated = await this.prisma.building.update({ where: { id }, data: dto });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'building',
      entityId: id,
      action: 'BUILDING_UPDATED',
      oldValues: { name: existing.name, type: existing.type, capacity: existing.capacity },
      newValues: { ...dto },
      ipAddress,
    });
    return updated;
  }

  /** Garde ajoutée avec ce lot (Bâtiments/Blocs) : jusqu'ici aucune UI
   * n'exposait de bouton de suppression, le gap n'avait donc jamais
   * d'impact réel. buildingId est une FK OBLIGATOIRE (onDelete implicite
   * = Restrict) sur BroilerBatch/LayerBatch/BreederBatch/Employee et
   * facultative (Restrict par défaut aussi) sur ChickBatch — sans cette
   * vérification, une suppression sur un bâtiment utilisé remonterait une
   * erreur SQL brute (500) plutôt qu'un 409 propre. Même patron que
   * AssetsService.remove()/LayerBatchesService.remove(). Les blocs du
   * bâtiment ne sont PAS comptés ici : les supprimer avec le bâtiment est
   * cohérent (ils n'ont aucun sens hors de leur bâtiment), voir remove()
   * ci-dessous. */
  private async assertRemovable(farmId: string, buildingId: string): Promise<void> {
    const [broilerCount, layerCount, breederCount, chickCount, employeeCount] = await Promise.all([
      this.prisma.broilerBatch.count({ where: { buildingId } }),
      this.prisma.layerBatch.count({ where: { buildingId } }),
      this.prisma.breederBatch.count({ where: { buildingId } }),
      this.prisma.chickBatch.count({ where: { buildingId } }),
      this.prisma.employee.count({ where: { buildingId, deletedAt: null } }),
    ]);
    if (broilerCount + layerCount + breederCount + chickCount + employeeCount > 0) {
      throw new ConflictException(
        'Suppression impossible — ce bâtiment est utilisé par au moins une bande ou un employé.',
      );
    }
  }

  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);
    await this.assertRemovable(actingUser.farmId, id);
    // Les blocs de ce bâtiment n'ont aucun sens hors de leur bâtiment —
    // suppression en cascade explicite (Prisma ne cascade pas
    // implicitement, onDelete par défaut = Restrict) plutôt qu'un blocage
    // qui obligerait à supprimer chaque bloc un par un avant le bâtiment.
    await this.prisma.block.deleteMany({ where: { buildingId: id } });
    await this.prisma.building.delete({ where: { id } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'building',
      entityId: id,
      action: 'BUILDING_DELETED',
      oldValues: { name: existing.name, type: existing.type },
      ipAddress,
    });
  }
}
