import { IsOptional, IsUUID } from 'class-validator';

export class ListExpensesQueryDto {
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
}
