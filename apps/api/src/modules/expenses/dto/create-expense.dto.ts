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

export class CreateExpenseDto {
  @IsOptional()
  @IsUUID('4')
  batchId?: string;

  @IsDateString()
  date!: string;

  /** Paramétrable, texte libre — ex. "aliments" pour rattacher le coût
   * alimentation (§6.3) sans mécanisme dédié. */
  @IsString()
  @MinLength(1)
  category!: string;

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

  @IsInt()
  @Min(0)
  amountFcfa!: number;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;
}
