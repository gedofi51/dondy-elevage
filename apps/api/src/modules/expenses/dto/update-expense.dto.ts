import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateExpenseDto {
  @IsOptional()
  @IsUUID('4')
  batchId?: string;

  @IsOptional()
  @IsUUID('4')
  layerBatchId?: string;

  @IsOptional()
  @IsUUID('4')
  chickBatchId?: string;

  @IsOptional()
  @IsUUID('4')
  breederBatchId?: string;

  @IsOptional()
  @IsUUID('4')
  incubationBatchId?: string;

  @IsOptional()
  @IsUUID('4')
  waterPointId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountFcfa?: number;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;
}
