import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Alert } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { PaginatedResult } from '../../common/pagination/paginated-result.interface';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { assertValidTransition, InvalidAlertTransitionError } from './alert-state-machine';
import type { CreateAlertDto } from './dto/create-alert.dto';
import type { ListAlertsQueryDto } from './dto/list-alerts.query.dto';

const NOTIFIED_SEVERITIES = ['IMPORTANT', 'CRITIQUE'];

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Création + déclenchement direct sont volontairement une seule étape par
   * défaut ("service capable de créer une alerte programmatiquement
   * (déclenchement direct)") : sans scheduledAt futur, l'alerte est créée
   * ET déclenchée immédiatement. Un scheduledAt futur laisse l'alerte en
   * CREATED, à déclencher plus tard via POST /:id/declencher (aucun
   * ordonnanceur cette phase pour le faire automatiquement).
   */
  async create(actingUser: AccessTokenPayload, dto: CreateAlertDto): Promise<Alert> {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const alert = await this.prisma.alert.create({
      data: {
        farmId: actingUser.farmId,
        type: dto.type,
        severity: dto.severity,
        entityType: dto.entityType,
        entityId: dto.entityId,
        title: dto.title,
        message: dto.message,
        scheduledAt,
      },
    });

    const isDueNow = !scheduledAt || scheduledAt.getTime() <= Date.now();
    if (isDueNow) {
      return this.triggerInternal(alert);
    }
    return alert;
  }

  async trigger(actingUser: AccessTokenPayload, id: string): Promise<Alert> {
    const alert = await this.findOne(actingUser, id);
    try {
      assertValidTransition(alert.status, 'TRIGGERED');
    } catch (error) {
      if (error instanceof InvalidAlertTransitionError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    return this.triggerInternal(alert);
  }

  private async triggerInternal(alert: Alert): Promise<Alert> {
    const triggered = await this.prisma.alert.update({
      where: { id: alert.id },
      data: { status: 'TRIGGERED', triggeredAt: new Date() },
    });

    if (NOTIFIED_SEVERITIES.includes(triggered.severity)) {
      await this.notificationsService.notifyForAlert(triggered);
    }

    return triggered;
  }

  async acknowledge(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<Alert> {
    const alert = await this.findOne(actingUser, id);
    try {
      assertValidTransition(alert.status, 'ACKNOWLEDGED');
    } catch (error) {
      if (error instanceof InvalidAlertTransitionError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    const acknowledged = await this.prisma.alert.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: actingUser.sub,
      },
    });

    // Seule mutation d'alerte auditée cette phase (voir demande : "alerts
    // acquittées") — création/déclenchement ne le sont pas.
    await this.auditLogService.record({
      farmId: alert.farmId,
      userId: actingUser.sub,
      entityType: 'alert',
      entityId: id,
      action: 'ALERT_ACKNOWLEDGED',
      oldValues: { status: alert.status },
      newValues: { status: acknowledged.status },
      ipAddress,
    });

    return acknowledged;
  }

  async findAll(
    actingUser: AccessTokenPayload,
    query: ListAlertsQueryDto,
  ): Promise<PaginatedResult<Alert>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = {
      farmId: actingUser.farmId,
      status: query.status,
      severity: query.severity,
    };

    const [items, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.alert.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Alert> {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundException('Alerte introuvable.');
    }
    assertSameFarm(actingUser, alert.farmId);
    return alert;
  }
}
