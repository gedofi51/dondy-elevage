import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { WaterReadingsService, type WaterReadingWithComputed } from './water-readings.service';
import { CreateWaterReadingDto } from './dto/create-water-reading.dto';
import { UpdateWaterReadingDto } from './dto/update-water-reading.dto';

@Controller('water-points/:waterPointId/readings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterReadingsController {
  constructor(private readonly waterReadingsService: WaterReadingsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.WATER_READINGS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('waterPointId') waterPointId: string,
    @Body() dto: CreateWaterReadingDto,
    @Req() req: Request,
  ): Promise<WaterReadingWithComputed> {
    return this.waterReadingsService.create(user, waterPointId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.WATER_READINGS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('waterPointId') waterPointId: string,
  ): Promise<WaterReadingWithComputed[]> {
    return this.waterReadingsService.findAll(user, waterPointId);
  }

  @Get(':date')
  @RequirePermissions(PERMISSIONS.WATER_READINGS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('waterPointId') waterPointId: string,
    @Param('date') date: string,
  ): Promise<WaterReadingWithComputed> {
    return this.waterReadingsService.findOne(user, waterPointId, date);
  }

  @Patch(':date')
  @RequirePermissions(PERMISSIONS.WATER_READINGS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('waterPointId') waterPointId: string,
    @Param('date') date: string,
    @Body() dto: UpdateWaterReadingDto,
    @Req() req: Request,
  ): Promise<WaterReadingWithComputed> {
    return this.waterReadingsService.update(user, waterPointId, date, dto, req.ip ?? null);
  }
}
