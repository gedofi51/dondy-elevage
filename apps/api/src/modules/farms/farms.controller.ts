import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Farm } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { FarmsService } from './farms.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

@Controller('farms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateFarmDto,
    @Req() req: Request,
  ): Promise<Farm> {
    return this.farmsService.create(user, dto, req.ip ?? null);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FARMS_READ)
  async findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<Farm> {
    return this.farmsService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FARMS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFarmDto,
    @Req() req: Request,
  ): Promise<Farm> {
    return this.farmsService.update(user, id, dto, req.ip ?? null);
  }
}
