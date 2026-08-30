import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Attendance } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { EmployeesService } from '../employees.service';
import type { CreateAttendanceDto } from './dto/create-attendance.dto';
import type { UpdateAttendanceDto } from './dto/update-attendance.dto';
import {
  assertAttendanceTimesConsistent,
  assertEmployeeActiveForNewAttendance,
} from './attendance.validation';

/**
 * Pointage journalier — module nesté sous Employee (`/employees/:employeeId/
 * attendance`), même patron structurel que WaterReadings sous WaterPoint
 * (1 relevé/jour, unique(entityId, date), PATCH de correction).
 * EmployeesService.findOne() réutilisé pour chaque accès : garantit
 * l'isolation farmId ET l'existence/non-suppression de l'employé en un
 * seul appel, sans dupliquer cette logique ici.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly employeesService: EmployeesService,
  ) {}

  private async getRaw(employeeId: string, dateParam: string): Promise<Attendance> {
    const attendance = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: new Date(dateParam) } },
    });
    if (!attendance) {
      throw new NotFoundException('Pointage introuvable.');
    }
    return attendance;
  }

  async create(
    actingUser: AccessTokenPayload,
    employeeId: string,
    dto: CreateAttendanceDto,
    ipAddress: string | null,
  ): Promise<Attendance> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    assertEmployeeActiveForNewAttendance(employee.status);
    assertAttendanceTimesConsistent(dto.status, dto.checkInTime, dto.checkOutTime);

    let attendance: Attendance;
    try {
      attendance = await this.prisma.attendance.create({
        data: {
          farmId: employee.farmId,
          employeeId,
          date: new Date(dto.date),
          status: dto.status,
          checkInTime: dto.checkInTime,
          checkOutTime: dto.checkOutTime,
          observations: dto.observations,
          createdBy: actingUser.sub,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un pointage existe déjà pour cet employé à cette date.');
      }
      throw error;
    }

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'attendance',
      entityId: attendance.id,
      action: 'ATTENDANCE_CREATED',
      newValues: { employeeId, date: dto.date, status: dto.status },
      ipAddress,
    });

    return attendance;
  }

  async findAll(actingUser: AccessTokenPayload, employeeId: string): Promise<Attendance[]> {
    await this.employeesService.findOne(actingUser, employeeId);
    return this.prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(
    actingUser: AccessTokenPayload,
    employeeId: string,
    dateParam: string,
  ): Promise<Attendance> {
    await this.employeesService.findOne(actingUser, employeeId);
    return this.getRaw(employeeId, dateParam);
  }

  /** Correction d'une journée déjà saisie — même patron que
   * WaterReadingsService.update() (fusion des valeurs existantes/DTO,
   * re-validation complète sur le résultat fusionné). Le statut actuel
   * de l'employé n'est PAS revérifié ici (voir
   * assertEmployeeActiveForNewAttendance, appliqué à la création
   * uniquement) : corriger un pointage historique reste possible même
   * si l'employé est devenu inactif depuis. */
  async update(
    actingUser: AccessTokenPayload,
    employeeId: string,
    dateParam: string,
    dto: UpdateAttendanceDto,
    ipAddress: string | null,
  ): Promise<Attendance> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    const existing = await this.getRaw(employeeId, dateParam);

    const mergedStatus = dto.status ?? existing.status;
    const mergedCheckIn = dto.checkInTime ?? existing.checkInTime;
    const mergedCheckOut = dto.checkOutTime ?? existing.checkOutTime;
    assertAttendanceTimesConsistent(mergedStatus, mergedCheckIn, mergedCheckOut);

    const updated = await this.prisma.attendance.update({
      where: { employeeId_date: { employeeId, date: existing.date } },
      data: {
        status: mergedStatus,
        checkInTime: mergedCheckIn,
        checkOutTime: mergedCheckOut,
        observations: dto.observations ?? existing.observations,
      },
    });

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'attendance',
      entityId: existing.id,
      action: 'ATTENDANCE_UPDATED',
      oldValues: {
        status: existing.status,
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
      },
      newValues: { status: mergedStatus, checkInTime: mergedCheckIn, checkOutTime: mergedCheckOut },
      ipAddress,
    });

    return updated;
  }
}
