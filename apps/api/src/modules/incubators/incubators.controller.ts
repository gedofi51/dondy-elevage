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
import type { Incubator } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { IncubatorsService } from './incubators.service';
import { CreateIncubatorDto } from './dto/create-incubator.dto';
import { UpdateIncubatorDto } from './dto/update-incubator.dto';

@Controller('incubators')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncubatorsController {
  constructor(private readonly incubatorsService: IncubatorsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.INCUBATORS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateIncubatorDto,
    @Req() req: Request,
  ): Promise<Incubator> {
    return this.incubatorsService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.INCUBATORS_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<Incubator[]> {
    return this.incubatorsService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.INCUBATORS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<Incubator> {
    return this.incubatorsService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.INCUBATORS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateIncubatorDto,
    @Req() req: Request,
  ): Promise<Incubator> {
    return this.incubatorsService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.INCUBATORS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.incubatorsService.remove(user, id, req.ip ?? null);
  }
}
