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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { EmployeesService, type EmployeeRosterEntry } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { maskSalaryForResponse, type EmployeeMaybeWithSalary } from './employees.validation';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateEmployeeDto,
    @Req() req: Request,
  ): Promise<EmployeeMaybeWithSalary> {
    const employee = await this.employeesService.create(user, dto, req.ip ?? null);
    return maskSalaryForResponse(employee, user.permissions);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<EmployeeMaybeWithSalary[]> {
    const employees = await this.employeesService.findAll(user);
    return employees.map((employee) => maskSalaryForResponse(employee, user.permissions));
  }

  /** Doit rester déclarée avant @Get(':id') — sinon Nest matcherait
   * "roster" comme :id (routes évaluées dans l'ordre de déclaration). */
  @Get('roster')
  @RequireAnyPermission(
    PERMISSIONS.EMPLOYEES_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.EMPLOYEE_TASKS_READ,
  )
  async roster(@CurrentUser() user: AccessTokenPayload): Promise<EmployeeRosterEntry[]> {
    return this.employeesService.findRoster(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<EmployeeMaybeWithSalary> {
    const employee = await this.employeesService.findOne(user, id);
    return maskSalaryForResponse(employee, user.permissions);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: Request,
  ): Promise<EmployeeMaybeWithSalary> {
    const employee = await this.employeesService.update(user, id, dto, req.ip ?? null);
    return maskSalaryForResponse(employee, user.permissions);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.employeesService.remove(user, id, req.ip ?? null);
  }
}
