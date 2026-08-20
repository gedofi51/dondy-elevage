import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class GoodsReceiptItemDto {
  @IsUUID('4')
  purchaseOrderItemId!: string;

  @IsNumber()
  @Min(0.001)
  receivedQuantity!: number;
}

export class CreateGoodsReceiptDto {
  @IsDateString()
  date!: string;

  /** Défaut = utilisateur courant si omis (comme Sale.sellerId). */
  @IsOptional()
  @IsUUID('4')
  responsibleId?: string;

  @IsOptional()
  @IsString()
  observation?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemDto)
  items!: GoodsReceiptItemDto[];
}
