import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { GoodsReceipt } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';

@Controller('purchase-orders/:purchaseOrderId/receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.GOODS_RECEIPTS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body() dto: CreateGoodsReceiptDto,
    @Req() req: Request,
  ): Promise<GoodsReceipt> {
    return this.goodsReceiptsService.create(user, purchaseOrderId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.GOODS_RECEIPTS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('purchaseOrderId') purchaseOrderId: string,
  ): Promise<GoodsReceipt[]> {
    return this.goodsReceiptsService.findAll(user, purchaseOrderId);
  }
}
