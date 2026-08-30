import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Payroll } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

@Controller('employees/:employeeId/payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PAYROLL_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreatePayrollDto,
    @Req() req: Request,
  ): Promise<Payroll> {
    return this.payrollService.create(user, employeeId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<Payroll[]> {
    return this.payrollService.findAll(user, employeeId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
  ): Promise<Payroll> {
    return this.payrollService.findOne(user, employeeId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PAYROLL_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollDto,
    @Req() req: Request,
  ): Promise<Payroll> {
    return this.payrollService.update(user, employeeId, id, dto, req.ip ?? null);
  }
}
