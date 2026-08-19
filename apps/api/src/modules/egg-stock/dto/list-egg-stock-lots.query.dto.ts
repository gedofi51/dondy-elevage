import { IsOptional, IsUUID } from 'class-validator';

export class ListEggStockLotsQueryDto {
  @IsOptional()
  @IsUUID('4')
  batchId?: string;
}
