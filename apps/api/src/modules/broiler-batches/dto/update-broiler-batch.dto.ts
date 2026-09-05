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
import { BroilerBatchStatus, BroilerOrigin } from '@prisma/client';

export class UpdateBroilerBatchDto {
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @IsEnum(BroilerOrigin)
  origin?: BroilerOrigin;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  orderedQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  receivedQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deadOnArrivalQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  transportCostFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  otherCostsFcfa?: number;

  @IsOptional()
  @IsUUID('4')
  buildingId?: string;

  /** Option A (Bâtiments/Blocs) — `null` explicite accepté (efface le
   * bloc), `@IsOptional()` de class-validator saute la validation pour
   * null/undefined. */
  @IsOptional()
  @IsUUID('4')
  blockId?: string | null;

  @IsOptional()
  @IsUUID('4')
  primaryManagerId?: string;

  @IsOptional()
  @IsDateString()
  plannedSaleDate?: string;

  /** Transitions de statut "libres" (BROUILLON..PRETE_A_VENDRE/EN_VENTE/VENDUE) —
   * ANNULEE et CLOTUREE passent par les endpoints dédiés (annuler/cloturer),
   * qui portent leurs propres règles métier. */
  @IsOptional()
  @IsEnum(BroilerBatchStatus)
  status?: BroilerBatchStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observations?: string;
}
