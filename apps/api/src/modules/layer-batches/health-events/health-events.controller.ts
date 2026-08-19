import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { LayerHealthEvent } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { HealthEventsService } from './health-events.service';
import { CreateHealthEventDto } from './dto/create-health-event.dto';
import { UpdateHealthEventDto } from './dto/update-health-event.dto';

@Controller('layer-batches/:batchId/health-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HealthEventsController {
  constructor(private readonly healthEventsService: HealthEventsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LAYER_HEALTH_EVENTS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Body() dto: CreateHealthEventDto,
    @Req() req: Request,
  ): Promise<LayerHealthEvent> {
    return this.healthEventsService.create(user, batchId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LAYER_HEALTH_EVENTS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
  ): Promise<LayerHealthEvent[]> {
    return this.healthEventsService.findAll(user, batchId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LAYER_HEALTH_EVENTS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('id') id: string,
  ): Promise<LayerHealthEvent> {
    return this.healthEventsService.findOne(user, batchId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LAYER_HEALTH_EVENTS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHealthEventDto,
    @Req() req: Request,
  ): Promise<LayerHealthEvent> {
    return this.healthEventsService.update(user, batchId, id, dto, req.ip ?? null);
  }
}
