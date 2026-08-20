import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { PurchaseOrdersService, type PurchaseOrderWithComputed } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PURCHASE_ORDERS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: Request,
  ): Promise<PurchaseOrderWithComputed> {
    return this.purchaseOrdersService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PURCHASE_ORDERS_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<PurchaseOrderWithComputed[]> {
    return this.purchaseOrdersService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PURCHASE_ORDERS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<PurchaseOrderWithComputed> {
    return this.purchaseOrdersService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PURCHASE_ORDERS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @Req() req: Request,
  ): Promise<PurchaseOrderWithComputed> {
    return this.purchaseOrdersService.update(user, id, dto, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.PURCHASE_ORDERS_CLOSE)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<PurchaseOrderWithComputed> {
    return this.purchaseOrdersService.cancel(user, id, req.ip ?? null);
  }
}
