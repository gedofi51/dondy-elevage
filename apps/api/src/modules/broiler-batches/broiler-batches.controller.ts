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
  BroilerBatchesService,
  type BatchClosureSummary,
  type BroilerBatchWithComputed,
} from './broiler-batches.service';
import type { BroilerForecast } from './calculations/broiler-forecast.calculations';
import type { BatchPerformanceScore } from './calculations/broiler-performance-score.calculations';
import { CreateBroilerBatchDto } from './dto/create-broiler-batch.dto';
import { UpdateBroilerBatchDto } from './dto/update-broiler-batch.dto';
import { UpdateBroilerPerformanceCoefficientsDto } from './dto/update-broiler-performance-coefficients.dto';

@Controller('broiler-batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BroilerBatchesController {
  constructor(private readonly broilerBatchesService: BroilerBatchesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateBroilerBatchDto,
    @Req() req: Request,
  ): Promise<BroilerBatchWithComputed> {
    return this.broilerBatchesService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<BroilerBatchWithComputed[]> {
    return this.broilerBatchesService.findAll(user);
  }

  // Déclarée AVANT @Get(':id') — Nest matche par ordre de déclaration,
  // même précaution que ItemsController.previsions (Lot 2).
  @Get('previsions')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_READ)
  async findAllForecast(@CurrentUser() user: AccessTokenPayload): Promise<BroilerForecast[]> {
    return this.broilerBatchesService.findAllForecast(user);
  }

  // Déclarées AVANT @Get(':id') — même précaution que 'previsions'
  // ci-dessus (Nest matche par ordre de déclaration).
  @Get('performance-coefficients')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_READ)
  async getPerformanceCoefficients(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PerformanceScoreCoefficients> {
    return this.broilerBatchesService.getPerformanceCoefficients(user);
  }

  // Lot 5 (score de performance) : administration des coefficients (poids,
  // cibles GMQ/IC) réservée à FARMS_UPDATE — permission déjà détenue
  // uniquement par Propriétaire/Administrateur, aucune permission dédiée
  // créée (voir DETTE_TECHNIQUE.md Lot 5, investigation point 4).
  @Put('performance-coefficients')
  @RequirePermissions(PERMISSIONS.FARMS_UPDATE)
  async updatePerformanceCoefficients(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateBroilerPerformanceCoefficientsDto,
  ): Promise<PerformanceScoreCoefficients> {
    return this.broilerBatchesService.updatePerformanceCoefficients(user, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<BroilerBatchWithComputed> {
    return this.broilerBatchesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBroilerBatchDto,
    @Req() req: Request,
  ): Promise<BroilerBatchWithComputed> {
    return this.broilerBatchesService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.broilerBatchesService.remove(user, id, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_DELETE)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<BroilerBatchWithComputed> {
    return this.broilerBatchesService.cancel(user, id, req.ip ?? null);
  }

  @Post(':id/cloturer')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_CLOSE)
  async close(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ batch: BroilerBatchWithComputed; summary: BatchClosureSummary }> {
    return this.broilerBatchesService.close(user, id, req.ip ?? null);
  }

  @Get(':id/profitability')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_READ)
  async getProfitability(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<BatchClosureSummary> {
    return this.broilerBatchesService.getProfitability(user, id);
  }

  @Get(':id/performance-score')
  @RequirePermissions(PERMISSIONS.BROILER_BATCHES_READ)
  async getPerformanceScore(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<BatchPerformanceScore> {
    return this.broilerBatchesService.getPerformanceScore(user, id);
  }
}
