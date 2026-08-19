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
import type { BroilerMortality } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { MortalityService } from './mortality.service';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { UpdateMortalityDto } from './dto/update-mortality.dto';

@Controller('broiler-batches/:batchId/mortality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MortalityController {
  constructor(private readonly mortalityService: MortalityService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.BROILER_MORTALITY_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Body() dto: CreateMortalityDto,
    @Req() req: Request,
  ): Promise<BroilerMortality> {
    return this.mortalityService.create(user, batchId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BROILER_MORTALITY_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
  ): Promise<BroilerMortality[]> {
    return this.mortalityService.findAll(user, batchId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BROILER_MORTALITY_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('id') id: string,
  ): Promise<BroilerMortality> {
    return this.mortalityService.findOne(user, batchId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BROILER_MORTALITY_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMortalityDto,
    @Req() req: Request,
  ): Promise<BroilerMortality> {
    return this.mortalityService.update(user, batchId, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BROILER_MORTALITY_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.mortalityService.remove(user, batchId, id, req.ip ?? null);
  }
}
