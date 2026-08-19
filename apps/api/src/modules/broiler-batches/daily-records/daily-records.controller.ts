import { Body, Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { BroilerDailyRecord } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { DailyRecordsService } from './daily-records.service';
import { UpdateDailyRecordDto } from './dto/update-daily-record.dto';

@Controller('broiler-batches/:batchId/daily-records')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DailyRecordsController {
  constructor(private readonly dailyRecordsService: DailyRecordsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BROILER_DAILY_RECORDS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
  ): Promise<BroilerDailyRecord[]> {
    return this.dailyRecordsService.findAll(user, batchId);
  }

  @Get(':dayNumber')
  @RequirePermissions(PERMISSIONS.BROILER_DAILY_RECORDS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
  ): Promise<BroilerDailyRecord> {
    return this.dailyRecordsService.findOne(user, batchId, dayNumber);
  }

  @Patch(':dayNumber')
  @RequirePermissions(PERMISSIONS.BROILER_DAILY_RECORDS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
    @Body() dto: UpdateDailyRecordDto,
    @Req() req: Request,
  ): Promise<BroilerDailyRecord> {
    return this.dailyRecordsService.update(user, batchId, dayNumber, dto, req.ip ?? null);
  }
}
