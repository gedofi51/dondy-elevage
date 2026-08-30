import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { EmployeeTasksService, type EmployeeTaskWithComputed } from './employee-tasks.service';
import { CreateEmployeeTaskDto } from './dto/create-employee-task.dto';
import { UpdateEmployeeTaskDto } from './dto/update-employee-task.dto';
import { CancelEmployeeTaskDto } from './dto/cancel-employee-task.dto';

@Controller('employees/:employeeId/tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeTasksController {
  constructor(private readonly employeeTasksService: EmployeeTasksService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_TASKS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateEmployeeTaskDto,
    @Req() req: Request,
  ): Promise<EmployeeTaskWithComputed> {
    return this.employeeTasksService.create(user, employeeId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_TASKS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<EmployeeTaskWithComputed[]> {
    return this.employeeTasksService.findAll(user, employeeId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_TASKS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
  ): Promise<EmployeeTaskWithComputed> {
    return this.employeeTasksService.findOne(user, employeeId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_TASKS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeTaskDto,
    @Req() req: Request,
  ): Promise<EmployeeTaskWithComputed> {
    return this.employeeTasksService.update(user, employeeId, id, dto, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_TASKS_UPDATE)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
    @Body() dto: CancelEmployeeTaskDto,
    @Req() req: Request,
  ): Promise<EmployeeTaskWithComputed> {
    return this.employeeTasksService.cancel(user, employeeId, id, dto, req.ip ?? null);
  }
}
