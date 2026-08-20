import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { StockMovement } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements.query.dto';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.STOCK_MOVEMENTS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateStockMovementDto,
    @Req() req: Request,
  ): Promise<StockMovement> {
    return this.stockMovementsService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.STOCK_MOVEMENTS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListStockMovementsQueryDto,
  ): Promise<StockMovement[]> {
    return this.stockMovementsService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STOCK_MOVEMENTS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<StockMovement> {
    return this.stockMovementsService.findOne(user, id);
  }
}
