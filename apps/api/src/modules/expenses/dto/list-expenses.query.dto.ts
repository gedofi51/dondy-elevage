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
}
