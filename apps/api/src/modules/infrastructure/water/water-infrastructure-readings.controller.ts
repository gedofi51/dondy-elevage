import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import {
  WaterInfrastructureReadingsService,
  type WaterInfrastructureReadingWithComputed,
} from './water-infrastructure-readings.service';
import { CreateWaterInfrastructureReadingDto } from './dto/create-water-infrastructure-reading.dto';
import { UpdateWaterInfrastructureReadingDto } from './dto/update-water-infrastructure-reading.dto';

@Controller('assets/:assetId/water-infrastructure-readings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterInfrastructureReadingsController {
  constructor(private readonly readingsService: WaterInfrastructureReadingsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Body() dto: CreateWaterInfrastructureReadingDto,
    @Req() req: Request,
  ): Promise<WaterInfrastructureReadingWithComputed> {
    return this.readingsService.create(user, assetId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
  ): Promise<WaterInfrastructureReadingWithComputed[]> {
    return this.readingsService.findAll(user, assetId);
  }

  @Get(':date')
  @RequirePermissions(PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Param('date') date: string,
  ): Promise<WaterInfrastructureReadingWithComputed> {
    return this.readingsService.findOne(user, assetId, date);
  }

  @Patch(':date')
  @RequirePermissions(PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Param('date') date: string,
    @Body() dto: UpdateWaterInfrastructureReadingDto,
    @Req() req: Request,
  ): Promise<WaterInfrastructureReadingWithComputed> {
    return this.readingsService.update(user, assetId, date, dto, req.ip ?? null);
  }
}
