import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { PerformanceScoreCoefficients } from '../../common/calculations/performance-score.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  IncubationBatchesService,
  type IncubationBatchProfitability,
  type IncubationBatchWithComputed,
} from './incubation-batches.service';
import type { BatchPerformanceScore } from './calculations/incubation-performance-score.calculations';
import { CreateIncubationBatchDto } from './dto/create-incubation-batch.dto';
import { UpdateIncubationBatchDto } from './dto/update-incubation-batch.dto';
import { UpdateIncubationPerformanceCoefficientsDto } from './dto/update-incubation-performance-coefficients.dto';

@Controller('incubation-batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncubationBatchesController {
  constructor(private readonly incubationBatchesService: IncubationBatchesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateIncubationBatchDto,
    @Req() req: Request,
  ): Promise<IncubationBatchWithComputed> {
    return this.incubationBatchesService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<IncubationBatchWithComputed[]> {
    return this.incubationBatchesService.findAll(user);
  }

  // Déclarées AVANT @Get(':id') — Nest matche par ordre de déclaration,
  // même précaution que BroilerBatchesController/'previsions'.
  @Get('performance-coefficients')
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_READ)
  async getPerformanceCoefficients(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PerformanceScoreCoefficients> {
    return this.incubationBatchesService.getPerformanceCoefficients(user);
  }

  @Put('performance-coefficients')
  @RequirePermissions(PERMISSIONS.FARMS_UPDATE)
  async updatePerformanceCoefficients(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateIncubationPerformanceCoefficientsDto,
  ): Promise<PerformanceScoreCoefficients> {
    return this.incubationBatchesService.updatePerformanceCoefficients(user, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<IncubationBatchWithComputed> {
    return this.incubationBatchesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateIncubationBatchDto,
    @Req() req: Request,
  ): Promise<IncubationBatchWithComputed> {
    return this.incubationBatchesService.update(user, id, dto, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_UPDATE)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<IncubationBatchWithComputed> {
    return this.incubationBatchesService.cancel(user, id, req.ip ?? null);
  }

  @Post(':id/cloturer')
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_CLOSE)
  async close(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<IncubationBatchWithComputed> {
    return this.incubationBatchesService.close(user, id, req.ip ?? null);
  }

  @Get(':id/profitability')
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_READ)
  async getProfitability(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<IncubationBatchProfitability> {
    return this.incubationBatchesService.getProfitability(user, id);
  }

  @Get(':id/performance-score')
  @RequirePermissions(PERMISSIONS.INCUBATION_BATCHES_READ)
  async getPerformanceScore(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<BatchPerformanceScore> {
    return this.incubationBatchesService.getPerformanceScore(user, id);
  }
}
