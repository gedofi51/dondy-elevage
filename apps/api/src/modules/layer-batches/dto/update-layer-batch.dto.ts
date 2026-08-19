import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { LayerBatchStatus } from '@prisma/client';

export class UpdateLayerBatchDto {
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsOptional()
  @IsString()
  strain?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  initialQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageAtEntryWeeks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageAtEntryDays?: number;

  @IsOptional()
  @IsUUID('4')
  buildingId?: string;

  @IsOptional()
  @IsUUID('4')
  primaryManagerId?: string;

  /** Transitions "libres" (ELEVAGE/PONTE/REFORME) — ANNULEE et CLOTURE
   * passent par les endpoints dédiés (annuler/cloturer), qui portent leurs
   * propres règles métier. */
  @IsOptional()
  @IsEnum(LayerBatchStatus)
  status?: LayerBatchStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observations?: string;
}
