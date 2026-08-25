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

  /** Phase 16 — coûts postérieurs à l'acquisition d'un actif (réparation,
   * consommable, autre), alimente le TCO partiel calculé sur Asset. */
  @IsOptional()
  @IsUUID('4')
  assetId?: string;

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
