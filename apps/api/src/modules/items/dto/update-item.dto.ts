import { IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

/** Pas de currentStock/averageUnitCostFcfa modifiables ici : écrits
 * exclusivement par StockMovementsService.recordMovementInTransaction. */
export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minThreshold?: number;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;
}
