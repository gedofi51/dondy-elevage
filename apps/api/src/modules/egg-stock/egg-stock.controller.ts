import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { EggStockMovement } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { EggStockService, type EggStockLotWithRemaining } from './egg-stock.service';
import { CreateEggStockMovementDto } from './dto/create-egg-stock-movement.dto';
import { ListEggStockLotsQueryDto } from './dto/list-egg-stock-lots.query.dto';
import { ListEggStockMovementsQueryDto } from './dto/list-egg-stock-movements.query.dto';

@Controller('egg-stock')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EggStockController {
  constructor(private readonly eggStockService: EggStockService) {}

  @Get('lots')
  @RequirePermissions(PERMISSIONS.EGG_STOCK_LOTS_READ)
  async findLots(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListEggStockLotsQueryDto,
  ): Promise<EggStockLotWithRemaining[]> {
    return this.eggStockService.findLots(user, query);
  }

  @Get('lots/:id')
  @RequirePermissions(PERMISSIONS.EGG_STOCK_LOTS_READ)
  async findLot(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<EggStockLotWithRemaining> {
    return this.eggStockService.findLot(user, id);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.EGG_STOCK_MOVEMENTS_READ)
  async findMovements(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListEggStockMovementsQueryDto,
  ): Promise<EggStockMovement[]> {
    return this.eggStockService.findMovements(user, query);
  }

  @Post('movements')
  @RequirePermissions(PERMISSIONS.EGG_STOCK_MOVEMENTS_CREATE)
  async createMovement(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateEggStockMovementDto,
    @Req() req: Request,
  ): Promise<EggStockMovement> {
    return this.eggStockService.createManualMovement(user, dto, req.ip ?? null);
  }
}
