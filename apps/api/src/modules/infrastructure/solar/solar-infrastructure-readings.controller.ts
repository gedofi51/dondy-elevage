import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { SolarInfrastructureReading } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { SolarInfrastructureReadingsService } from './solar-infrastructure-readings.service';
import { CreateSolarInfrastructureReadingDto } from './dto/create-solar-infrastructure-reading.dto';
import { UpdateSolarInfrastructureReadingDto } from './dto/update-solar-infrastructure-reading.dto';

@Controller('assets/:assetId/solar-infrastructure-readings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SolarInfrastructureReadingsController {
  constructor(private readonly readingsService: SolarInfrastructureReadingsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Body() dto: CreateSolarInfrastructureReadingDto,
    @Req() req: Request,
  ): Promise<SolarInfrastructureReading> {
    return this.readingsService.create(user, assetId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
  ): Promise<SolarInfrastructureReading[]> {
    return this.readingsService.findAll(user, assetId);
  }

  @Get(':date')
  @RequirePermissions(PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Param('date') date: string,
  ): Promise<SolarInfrastructureReading> {
    return this.readingsService.findOne(user, assetId, date);
  }

  @Patch(':date')
  @RequirePermissions(PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Param('date') date: string,
    @Body() dto: UpdateSolarInfrastructureReadingDto,
    @Req() req: Request,
  ): Promise<SolarInfrastructureReading> {
    return this.readingsService.update(user, assetId, date, dto, req.ip ?? null);
  }
}
