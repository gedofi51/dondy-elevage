import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const publicUserSelect = {
  id: true,
  farmId: true,
  email: true,
  name: true,
  status: true,
  emailVerified: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
  userRoles: { select: { role: { select: { id: true, name: true } } } },
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateUserDto,
    ipAddress: string | null,
  ): Promise<PublicUser> {
    const isPlatformManager = actingUser.permissions.includes(PERMISSIONS.PLATFORM_MANAGE);
    const targetFarmId = dto.farmId && isPlatformManager ? dto.farmId : actingUser.farmId;

    const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
    if (roles.length !== dto.roleIds.length) {
      throw new NotFoundException('Un ou plusieurs rôles sont introuvables.');
    }

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          farmId: targetFarmId,
          email: dto.email,
          name: dto.name,
          createdBy: actingUser.sub,
          userRoles: { create: roles.map((role) => ({ roleId: role.id })) },
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un utilisateur avec cet email existe déjà sur cette ferme.');
      }
      throw error;
    }

    await this.authService.issueInvitation(user.id, user.email, user.name);
    await this.auditLogService.record({
      farmId: targetFarmId,
      userId: actingUser.sub,
      entityType: 'user',
      entityId: user.id,
      action: 'USER_CREATED',
      newValues: { email: user.email, name: user.name, roleIds: dto.roleIds },
      ipAddress,
    });

    return user;
  }

  async findAll(actingUser: AccessTokenPayload): Promise<PublicUser[]> {
    return this.prisma.user.findMany({
      where: { farmId: actingUser.farmId },
      select: publicUserSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    assertSameFarm(actingUser, user.farmId);
    return user;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateUserDto,
    ipAddress: string | null,
  ): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    assertSameFarm(actingUser, existing.farmId);

    if (dto.roleIds) {
      const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
      if (roles.length !== dto.roleIds.length) {
        throw new NotFoundException('Un ou plusieurs rôles sont introuvables.');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          name: dto.name,
          status: dto.status,
        },
        select: publicUserSelect,
      });
    });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'user',
      entityId: id,
      action: 'USER_UPDATED',
      oldValues: { name: existing.name, status: existing.status },
      newValues: { name: updated.name, status: updated.status, roleIds: dto.roleIds },
      ipAddress,
    });

    return updated;
  }
}
