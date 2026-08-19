import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { LayerDailyRecord } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { DailyRecordsService } from './daily-records.service';
import { CreateDailyRecordDto } from './dto/create-daily-record.dto';
import { UpdateDailyRecordDto } from './dto/update-daily-record.dto';

@Controller('layer-batches/:batchId/daily-records')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DailyRecordsController {
  constructor(private readonly dailyRecordsService: DailyRecordsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LAYER_DAILY_RECORDS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Body() dto: CreateDailyRecordDto,
    @Req() req: Request,
  ): Promise<LayerDailyRecord> {
    return this.dailyRecordsService.create(user, batchId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LAYER_DAILY_RECORDS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
  ): Promise<LayerDailyRecord[]> {
    return this.dailyRecordsService.findAll(user, batchId);
  }

  @Get(':date')
  @RequirePermissions(PERMISSIONS.LAYER_DAILY_RECORDS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('date') date: string,
  ): Promise<LayerDailyRecord> {
    return this.dailyRecordsService.findOne(user, batchId, date);
  }

  @Patch(':date')
  @RequirePermissions(PERMISSIONS.LAYER_DAILY_RECORDS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Param('date') date: string,
    @Body() dto: UpdateDailyRecordDto,
    @Req() req: Request,
  ): Promise<LayerDailyRecord> {
    return this.dailyRecordsService.update(user, batchId, date, dto, req.ip ?? null);
  }
}
