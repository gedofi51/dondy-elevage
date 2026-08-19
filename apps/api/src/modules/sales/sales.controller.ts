import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Sale } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales.query.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateSaleDto,
    @Req() req: Request,
  ): Promise<Sale> {
    return this.salesService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListSalesQueryDto,
  ): Promise<Sale[]> {
    return this.salesService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  async findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<Sale> {
    return this.salesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SALES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
    @Req() req: Request,
  ): Promise<Sale> {
    return this.salesService.update(user, id, dto, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.SALES_UPDATE)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Sale> {
    return this.salesService.cancel(user, id, req.ip ?? null);
  }
}
