import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  MaintenanceInterventionsService,
  type MaintenanceInterventionWithComputed,
} from './maintenance-interventions.service';
import { CreateMaintenanceInterventionDto } from './dto/create-maintenance-intervention.dto';

/** Pas de PATCH/DELETE — append-only, voir MaintenanceInterventionsService. */
@Controller('maintenance-interventions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenanceInterventionsController {
  constructor(private readonly maintenanceInterventionsService: MaintenanceInterventionsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_INTERVENTIONS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateMaintenanceInterventionDto,
    @Req() req: Request,
  ): Promise<MaintenanceInterventionWithComputed> {
    return this.maintenanceInterventionsService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_INTERVENTIONS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<MaintenanceInterventionWithComputed[]> {
    return this.maintenanceInterventionsService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_INTERVENTIONS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<MaintenanceInterventionWithComputed> {
    return this.maintenanceInterventionsService.findOne(user, id);
  }
}
