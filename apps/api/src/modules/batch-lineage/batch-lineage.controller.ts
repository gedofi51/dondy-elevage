import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { BatchLineage } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { BatchLineageService } from './batch-lineage.service';
import { ListBatchLineageQueryDto } from './dto/list-batch-lineage.query.dto';

@Controller('batch-lineage')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BatchLineageController {
  constructor(private readonly batchLineageService: BatchLineageService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BATCH_LINEAGE_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListBatchLineageQueryDto,
  ): Promise<BatchLineage[]> {
    return this.batchLineageService.findAll(user, query);
  }
}
