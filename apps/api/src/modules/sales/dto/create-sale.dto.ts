import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { SaleMode, SaleProductType, SaleStatus } from '@prisma/client';

export class CreateSaleDto {
  @IsEnum(SaleProductType)
  productType!: SaleProductType;

  /** Requis si productType = POULET_CHAIR (vérifié en service, pas ici —
   * dépend d'un autre champ, comme CreateBroilerBatchDto.supplierId). */
  @ValidateIf((dto: CreateSaleDto) => dto.productType === 'POULET_CHAIR')
  @IsUUID('4')
  batchId?: string;

  /** Requis si productType = OEUFS. */
  @ValidateIf((dto: CreateSaleDto) => dto.productType === 'OEUFS')
  @IsUUID('4')
  layerBatchId?: string;

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
