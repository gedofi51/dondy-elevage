import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { CHECK_TIME_PATTERN } from '../attendance.validation';

/** `date` absent — immuable après création, identifiant de la ressource
 * (route `:date`), même discipline que WaterReading (date jamais
 * modifiable via son UpdateDto, seul l'index/le montant se corrigent). */
export class UpdateAttendanceDto {
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

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
