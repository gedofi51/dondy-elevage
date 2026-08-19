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
import { BreederBatchesService, type BreederBatchWithComputed } from './breeder-batches.service';
import { CreateBreederBatchDto } from './dto/create-breeder-batch.dto';
import { UpdateBreederBatchDto } from './dto/update-breeder-batch.dto';

@Controller('breeder-batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BreederBatchesController {
  constructor(private readonly breederBatchesService: BreederBatchesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.BREEDER_BATCHES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateBreederBatchDto,
    @Req() req: Request,
  ): Promise<BreederBatchWithComputed> {
    return this.breederBatchesService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BREEDER_BATCHES_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<BreederBatchWithComputed[]> {
    return this.breederBatchesService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BREEDER_BATCHES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<BreederBatchWithComputed> {
    return this.breederBatchesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BREEDER_BATCHES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBreederBatchDto,
    @Req() req: Request,
  ): Promise<BreederBatchWithComputed> {
    return this.breederBatchesService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BREEDER_BATCHES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.breederBatchesService.remove(user, id, req.ip ?? null);
  }

  @Post(':id/annuler')
  @RequirePermissions(PERMISSIONS.BREEDER_BATCHES_DELETE)
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<BreederBatchWithComputed> {
    return this.breederBatchesService.cancel(user, id, req.ip ?? null);
  }

  @Post(':id/cloturer')
  @RequirePermissions(PERMISSIONS.BREEDER_BATCHES_CLOSE)
  async close(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<BreederBatchWithComputed> {
    return this.breederBatchesService.close(user, id, req.ip ?? null);
  }
}
