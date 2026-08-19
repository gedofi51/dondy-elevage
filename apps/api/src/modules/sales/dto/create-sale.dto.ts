import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { SaleMode, SaleStatus } from '@prisma/client';

export class CreateSaleDto {
  @IsUUID('4')
  batchId!: string;

  @IsDateString()
  date!: string;

  @IsUUID('4')
  customerId!: string;

  /** Défaut = utilisateur courant si omis. */
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @IsEnum(SaleMode)
  saleMode!: SaleMode;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsInt()
  @Min(0)
  unitPriceFcfa!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountFcfa?: number;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsString()
  observation?: string;
}
