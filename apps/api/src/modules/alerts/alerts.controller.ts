import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Alert } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { PaginatedResult } from '../../common/pagination/paginated-result.interface';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { ListAlertsQueryDto } from './dto/list-alerts.query.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ALERTS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateAlertDto,
  ): Promise<Alert> {
    return this.alertsService.create(user, dto);
  }

  @Post(':id/declencher')
  @RequirePermissions(PERMISSIONS.ALERTS_CREATE)
  async trigger(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<Alert> {
    return this.alertsService.trigger(user, id);
  }

  @Post(':id/acquitter')
  @RequirePermissions(PERMISSIONS.ALERTS_ACKNOWLEDGE)
  async acknowledge(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Alert> {
    return this.alertsService.acknowledge(user, id, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ALERTS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListAlertsQueryDto,
  ): Promise<PaginatedResult<Alert>> {
    return this.alertsService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ALERTS_READ)
  async findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<Alert> {
    return this.alertsService.findOne(user, id);
  }
}
