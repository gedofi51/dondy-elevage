import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { CHECK_TIME_PATTERN } from '../attendance.validation';

/**
 * `employeeId` absent : porté par la route (`/employees/:employeeId/
 * attendance`), même patron que `waterPointId` sur CreateWaterReadingDto.
 * `farmId` absent : toujours dérivé de l'employé concerné (voir
 * AttendanceService), jamais fourni par le client.
 */
export class CreateAttendanceDto {
  @IsDateString()
  date!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @Matches(CHECK_TIME_PATTERN, { message: 'checkInTime doit être au format HH:mm (24h).' })
  checkInTime?: string;

  @IsOptional()
  @IsString()
  @Matches(CHECK_TIME_PATTERN, { message: 'checkOutTime doit être au format HH:mm (24h).' })
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
