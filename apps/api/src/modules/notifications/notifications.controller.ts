import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../../common/pagination/paginated-result.interface';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';

/**
 * Pas de PermissionsGuard : les notifications sont auto-scopées à
 * l'utilisateur courant (userId = actingUser.sub), comme les endpoints 2FA
 * de AuthController — une action sur sa propre ressource ne nécessite pas
 * de permission dédiée.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedResult<Notification>> {
    return this.notificationsService.findAll(user, query);
  }

  @Patch(':id/lu')
  async markAsRead(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<Notification> {
    return this.notificationsService.markAsRead(user, id);
  }
}
