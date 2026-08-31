import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { SalaryAdvance } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { SalaryAdvancesService } from './salary-advances.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';

@Controller('employees/:employeeId/advances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalaryAdvancesController {
  constructor(private readonly salaryAdvancesService: SalaryAdvancesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SALARY_ADVANCES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateSalaryAdvanceDto,
    @Req() req: Request,
  ): Promise<SalaryAdvance> {
    return this.salaryAdvancesService.create(user, employeeId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALARY_ADVANCES_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<SalaryAdvance[]> {
    return this.salaryAdvancesService.findAll(user, employeeId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALARY_ADVANCES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
  ): Promise<SalaryAdvance> {
    return this.salaryAdvancesService.findOne(user, employeeId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SALARY_ADVANCES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSalaryAdvanceDto,
    @Req() req: Request,
  ): Promise<SalaryAdvance> {
    return this.salaryAdvancesService.update(user, employeeId, id, dto, req.ip ?? null);
  }
}
