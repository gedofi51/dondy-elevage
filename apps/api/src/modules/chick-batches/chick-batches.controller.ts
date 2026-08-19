import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { ChickBatchesService, type ChickBatchWithComputed } from './chick-batches.service';
import { UpdateChickBatchDto } from './dto/update-chick-batch.dto';

/** Pas de POST : un ChickBatch naît toujours d'une orientation, voir
 * POST /incubation-batches/:id/orientation. */
@Controller('chick-batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChickBatchesController {
  constructor(private readonly chickBatchesService: ChickBatchesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CHICK_BATCHES_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<ChickBatchWithComputed[]> {
    return this.chickBatchesService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CHICK_BATCHES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<ChickBatchWithComputed> {
    return this.chickBatchesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CHICK_BATCHES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateChickBatchDto,
    @Req() req: Request,
  ): Promise<ChickBatchWithComputed> {
    return this.chickBatchesService.update(user, id, dto, req.ip ?? null);
  }
}
