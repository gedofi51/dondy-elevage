import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BroilerOrigin } from '@prisma/client';

export class CreateBroilerBatchDto {
  @IsDateString()
  arrivalDate!: string;

  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsEnum(BroilerOrigin)
  origin!: BroilerOrigin;

  /** Requis si origin = ACHAT (vérifié en service, pas ici — dépend d'un autre champ). */
  @ValidateIf((dto: CreateBroilerBatchDto) => dto.origin === 'ACHAT')
  @IsUUID('4')
  supplierId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsInt()
  @Min(1)
  orderedQuantity!: number;

  @IsInt()
  @Min(1)
  receivedQuantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deadOnArrivalQuantity?: number;

  @IsInt()
  @Min(0)
  unitPriceFcfa!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  transportCostFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  otherCostsFcfa?: number;

  @IsUUID('4')
  buildingId!: string;

  /** Option A (Bâtiments/Blocs) — facultatif, doit appartenir à
   * buildingId (vérifié en service). */
  @IsOptional()
  @IsUUID('4')
  blockId?: string;

  @IsUUID('4')
  primaryManagerId!: string;

  /** Défaut = arrivalDate + 44 jours si omis (voir BroilerBatchesService.create). */
  @IsOptional()
  @IsDateString()
  plannedSaleDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observations?: string;
}
