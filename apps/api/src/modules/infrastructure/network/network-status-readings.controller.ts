import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { NetworkStatusReading } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { NetworkStatusReadingsService } from './network-status-readings.service';
import { CreateNetworkStatusReadingDto } from './dto/create-network-status-reading.dto';
import { UpdateNetworkStatusReadingDto } from './dto/update-network-status-reading.dto';

@Controller('assets/:assetId/network-status-readings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NetworkStatusReadingsController {
  constructor(private readonly readingsService: NetworkStatusReadingsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.NETWORK_STATUS_READINGS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Body() dto: CreateNetworkStatusReadingDto,
    @Req() req: Request,
  ): Promise<NetworkStatusReading> {
    return this.readingsService.create(user, assetId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.NETWORK_STATUS_READINGS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
  ): Promise<NetworkStatusReading[]> {
    return this.readingsService.findAll(user, assetId);
  }

  @Get(':date')
  @RequirePermissions(PERMISSIONS.NETWORK_STATUS_READINGS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Param('date') date: string,
  ): Promise<NetworkStatusReading> {
    return this.readingsService.findOne(user, assetId, date);
  }

  @Patch(':date')
  @RequirePermissions(PERMISSIONS.NETWORK_STATUS_READINGS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Param('date') date: string,
    @Body() dto: UpdateNetworkStatusReadingDto,
    @Req() req: Request,
  ): Promise<NetworkStatusReading> {
    return this.readingsService.update(user, assetId, date, dto, req.ip ?? null);
  }
}
