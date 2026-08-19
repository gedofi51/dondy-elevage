import { Injectable, NotFoundException } from '@nestjs/common';
import type { Alert, Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { PaginatedResult } from '../../common/pagination/paginated-result.interface';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actingUser: AccessTokenPayload,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedResult<Notification>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = {
      userId: actingUser.sub,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async markAsRead(actingUser: AccessTokenPayload, id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    // Auto-scopé au propriétaire — même logique que assertSameFarm (404
    // générique, jamais 403, pour ne pas révéler l'existence d'une
    // notification appartenant à quelqu'un d'autre).
    if (!notification || notification.userId !== actingUser.sub) {
      throw new NotFoundException('Notification introuvable.');
    }
    if (notification.readAt) {
      return notification;
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /**
   * Cible : tout utilisateur ACTIF de la ferme de l'alerte dont un rôle
   * porte la permission ALERTS_ACKNOWLEDGE — jamais un nom de rôle en dur
   * (RBAC piloté par données, cohérence avec le reste du système ; reste
   * correct même si un futur rôle personnalisé à une ferme obtient cette
   * permission).
   */
  async notifyForAlert(alert: Alert): Promise<void> {
    const targets = await this.prisma.user.findMany({
      where: {
        farmId: alert.farmId,
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: { permission: { code: PERMISSIONS.ALERTS_ACKNOWLEDGE } },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (targets.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: targets.map((user) => ({
        farmId: alert.farmId,
        userId: user.id,
        alertId: alert.id,
        title: alert.title,
        message: alert.message,
      })),
    });
  }
}
