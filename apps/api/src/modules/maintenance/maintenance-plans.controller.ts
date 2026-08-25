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
import type { MaintenancePlan } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { MaintenancePlansService } from './maintenance-plans.service';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';

@Controller('maintenance-plans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenancePlansController {
  constructor(private readonly maintenancePlansService: MaintenancePlansService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLANS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateMaintenancePlanDto,
    @Req() req: Request,
  ): Promise<MaintenancePlan> {
    return this.maintenancePlansService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLANS_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<MaintenancePlan[]> {
    return this.maintenancePlansService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLANS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<MaintenancePlan> {
    return this.maintenancePlansService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLANS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenancePlanDto,
    @Req() req: Request,
  ): Promise<MaintenancePlan> {
    return this.maintenancePlansService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLANS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.maintenancePlansService.remove(user, id, req.ip ?? null);
  }
}
