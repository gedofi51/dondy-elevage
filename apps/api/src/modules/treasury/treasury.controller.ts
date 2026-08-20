import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  TreasuryService,
  type PayableBySupplier,
  type ReceivableByCustomer,
  type TreasuryJournal,
  type TreasurySummary,
} from './treasury.service';
import { GetTreasuryPeriodQueryDto } from './dto/get-treasury-period.query.dto';

@Controller('treasury')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get('journal')
  @RequirePermissions(PERMISSIONS.TREASURY_READ)
  async getJournal(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: GetTreasuryPeriodQueryDto,
  ): Promise<TreasuryJournal> {
    return this.treasuryService.getJournal(user, query);
  }

  @Get('receivables')
  @RequirePermissions(PERMISSIONS.TREASURY_READ)
  async getReceivables(@CurrentUser() user: AccessTokenPayload): Promise<ReceivableByCustomer[]> {
    return this.treasuryService.getReceivables(user);
  }

  @Get('payables')
  @RequirePermissions(PERMISSIONS.TREASURY_READ)
  async getPayables(@CurrentUser() user: AccessTokenPayload): Promise<PayableBySupplier[]> {
    return this.treasuryService.getPayables(user);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.TREASURY_READ)
  async getSummary(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: GetTreasuryPeriodQueryDto,
  ): Promise<TreasurySummary> {
    return this.treasuryService.getSummary(user, query);
  }
}
