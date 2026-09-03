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
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { PerformanceScoreCoefficients } from '../../common/calculations/performance-score.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  LayerBatchesService,
  type LayerBatchClosureSummary,
  type LayerBatchWithComputed,
} from './layer-batches.service';
import type { LayerForecast } from './calculations/layer-forecast.calculations';
import type { BatchPerformanceScore } from './calculations/layer-performance-score.calculations';
import { CreateLayerBatchDto } from './dto/create-layer-batch.dto';
import { UpdateLayerBatchDto } from './dto/update-layer-batch.dto';
import { UpdateLayerPerformanceCoefficientsDto } from './dto/update-layer-performance-coefficients.dto';

@Controller('layer-batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LayerBatchesController {
  constructor(private readonly layerBatchesService: LayerBatchesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateLayerBatchDto,
    @Req() req: Request,
  ): Promise<LayerBatchWithComputed> {
    return this.layerBatchesService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<LayerBatchWithComputed[]> {
    return this.layerBatchesService.findAll(user);
  }

  // Déclarée AVANT @Get(':id') — même précaution que BroilerBatchesController.
  @Get('previsions')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async findAllForecast(@CurrentUser() user: AccessTokenPayload): Promise<LayerForecast[]> {
    return this.layerBatchesService.findAllForecast(user);
  }

  // Déclarées AVANT @Get(':id') — même précaution que 'previsions'.
  @Get('performance-coefficients')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async getPerformanceCoefficients(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PerformanceScoreCoefficients> {
    return this.layerBatchesService.getPerformanceCoefficients(user);
  }

  @Put('performance-coefficients')
  @RequirePermissions(PERMISSIONS.FARMS_UPDATE)
  async updatePerformanceCoefficients(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateLayerPerformanceCoefficientsDto,
  ): Promise<PerformanceScoreCoefficients> {
    return this.layerBatchesService.updatePerformanceCoefficients(user, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<LayerBatchWithComputed> {
    return this.layerBatchesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLayerBatchDto,
    @Req() req: Request,
  ): Promise<LayerBatchWithComputed> {
    return this.layerBatchesService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.layerBatchesService.remove(user, id, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_DELETE)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<LayerBatchWithComputed> {
    return this.layerBatchesService.cancel(user, id, req.ip ?? null);
  }

  @Post(':id/cloturer')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_CLOSE)
  async close(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ batch: LayerBatchWithComputed; summary: LayerBatchClosureSummary }> {
    return this.layerBatchesService.close(user, id, req.ip ?? null);
  }

  @Get(':id/profitability')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async getProfitability(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<LayerBatchClosureSummary> {
    return this.layerBatchesService.getProfitability(user, id);
  }

  @Get(':id/performance-score')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async getPerformanceScore(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<BatchPerformanceScore> {
    return this.layerBatchesService.getPerformanceScore(user, id);
  }
}
