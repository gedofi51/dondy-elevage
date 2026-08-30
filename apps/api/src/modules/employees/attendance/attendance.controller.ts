import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Attendance } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Controller('employees/:employeeId/attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateAttendanceDto,
    @Req() req: Request,
  ): Promise<Attendance> {
    return this.attendanceService.create(user, employeeId, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<Attendance[]> {
    return this.attendanceService.findAll(user, employeeId);
  }

  @Get(':date')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
  ): Promise<Attendance> {
    return this.attendanceService.findOne(user, employeeId, date);
  }

  @Patch(':date')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: UpdateAttendanceDto,
    @Req() req: Request,
  ): Promise<Attendance> {
    return this.attendanceService.update(user, employeeId, date, dto, req.ip ?? null);
  }
}
