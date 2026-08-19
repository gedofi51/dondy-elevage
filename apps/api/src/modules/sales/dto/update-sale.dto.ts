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

export class UpdateSaleDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @IsOptional()
  @IsEnum(SaleMode)
  saleMode?: SaleMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountFcfa?: number;

  /** ANNULEE passe par l'endpoint dédié (annuler), qui porte sa propre
   * règle métier (bloqué si déjà payée). */
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsString()
  observation?: string;
}
