import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SupplierPayment } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { SupplierPaymentsService } from './supplier-payments.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { ListSupplierPaymentsQueryDto } from './dto/list-supplier-payments.query.dto';

@Controller('supplier-payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierPaymentsController {
  constructor(private readonly supplierPaymentsService: SupplierPaymentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SUPPLIER_PAYMENTS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateSupplierPaymentDto,
    @Req() req: Request,
  ): Promise<SupplierPayment> {
    return this.supplierPaymentsService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SUPPLIER_PAYMENTS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListSupplierPaymentsQueryDto,
  ): Promise<SupplierPayment[]> {
    return this.supplierPaymentsService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUPPLIER_PAYMENTS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<SupplierPayment> {
    return this.supplierPaymentsService.findOne(user, id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUPPLIER_PAYMENTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.supplierPaymentsService.remove(user, id, req.ip ?? null);
  }
}
