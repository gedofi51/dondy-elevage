import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { BreederBatchStatus } from '@prisma/client';

export class UpdateBreederBatchDto {
  @IsOptional()
  @IsString()
  strain?: string;

  @IsOptional()
  @IsDateString()
  constitutionDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  femaleCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maleCount?: number;

  @IsOptional()
  @IsUUID('4')
  buildingId?: string;

  @IsOptional()
  @IsUUID('4')
  primaryManagerId?: string;

  /** Transitions "libres" (ACTIF/REFORME) — ANNULEE et CLOTURE passent par
   * les endpoints dédiés (annuler/cloturer). */
  @IsOptional()
  @IsEnum(BreederBatchStatus)
  status?: BreederBatchStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observations?: string;
}
