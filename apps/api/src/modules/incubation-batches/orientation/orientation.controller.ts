import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { BatchLineage } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { OrientationService } from './orientation.service';
import { CreateOrientationDto } from './dto/create-orientation.dto';

@Controller('incubation-batches/:incubationBatchId/orientation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrientationController {
  constructor(private readonly orientationService: OrientationService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ORIENTATION_CREATE)
  async orient(
    @CurrentUser() user: AccessTokenPayload,
    @Param('incubationBatchId') incubationBatchId: string,
    @Body() dto: CreateOrientationDto,
    @Req() req: Request,
  ): Promise<BatchLineage> {
    return this.orientationService.orient(user, incubationBatchId, dto, req.ip ?? null);
  }
}
