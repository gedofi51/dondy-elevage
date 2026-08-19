import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { HealthEventRoute, HealthEventStatus, HealthEventType } from '@prisma/client';

export class UpdateHealthEventDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(HealthEventStatus)
  status?: HealthEventStatus;

  @IsOptional()
  @IsEnum(HealthEventType)
  type?: HealthEventType;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsString()
  motif?: string;

  @IsOptional()
  @IsString()
  dose?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationDays?: number;

  @IsOptional()
  @IsEnum(HealthEventRoute)
  administrationRoute?: HealthEventRoute;

  @IsOptional()
  @IsString()
  prescribedBy?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  costFcfa?: number;

  @IsOptional()
  @IsString()
  observation?: string;
}
