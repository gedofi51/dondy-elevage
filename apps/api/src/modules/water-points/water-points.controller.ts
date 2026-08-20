import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { WaterPoint } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { WaterPointsService, type WaterPointKpiSummary } from './water-points.service';
import { CreateWaterPointDto } from './dto/create-water-point.dto';
import { UpdateWaterPointDto } from './dto/update-water-point.dto';
import { GetWaterPointKpiQueryDto } from './dto/get-water-point-kpi.query.dto';

@Controller('water-points')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterPointsController {
  constructor(private readonly waterPointsService: WaterPointsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.WATER_POINTS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateWaterPointDto,
    @Req() req: Request,
  ): Promise<WaterPoint> {
    return this.waterPointsService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.WATER_POINTS_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<WaterPoint[]> {
    return this.waterPointsService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.WATER_POINTS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<WaterPoint> {
    return this.waterPointsService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.WATER_POINTS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWaterPointDto,
    @Req() req: Request,
  ): Promise<WaterPoint> {
    return this.waterPointsService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.WATER_POINTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.waterPointsService.remove(user, id, req.ip ?? null);
  }

  /** Données financières agrégées (théorique/encaissé/écart/créances) —
   * gardé sur WATER_READINGS_READ, pas WATER_POINTS_READ (même logique
   * que le reste du module : Employé/Vendeur n'y ont pas accès). */
  @Get(':id/kpi')
  @RequirePermissions(PERMISSIONS.WATER_READINGS_READ)
  async getKpi(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query() query: GetWaterPointKpiQueryDto,
  ): Promise<WaterPointKpiSummary> {
    return this.waterPointsService.getKpiSummary(user, id, query);
  }
}
