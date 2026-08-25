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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  MaintenanceTasksService,
  type MaintenanceTaskWithComputed,
} from './maintenance-tasks.service';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { UpdateMaintenanceTaskDto } from './dto/update-maintenance-task.dto';
import { CancelMaintenanceTaskDto } from './dto/cancel-maintenance-task.dto';

@Controller('maintenance-tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenanceTasksController {
  constructor(private readonly maintenanceTasksService: MaintenanceTasksService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_TASKS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateMaintenanceTaskDto,
    @Req() req: Request,
  ): Promise<MaintenanceTaskWithComputed> {
    return this.maintenanceTasksService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_TASKS_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<MaintenanceTaskWithComputed[]> {
    return this.maintenanceTasksService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_TASKS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<MaintenanceTaskWithComputed> {
    return this.maintenanceTasksService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_TASKS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceTaskDto,
    @Req() req: Request,
  ): Promise<MaintenanceTaskWithComputed> {
    return this.maintenanceTasksService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_TASKS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.maintenanceTasksService.remove(user, id, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_TASKS_CANCEL)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: CancelMaintenanceTaskDto,
    @Req() req: Request,
  ): Promise<MaintenanceTaskWithComputed> {
    return this.maintenanceTasksService.cancel(user, id, dto, req.ip ?? null);
  }
}
