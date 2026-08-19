import { IsOptional, IsUUID } from 'class-validator';

export class ListEggStockMovementsQueryDto {
  @IsOptional()
  @IsUUID('4')
  lotId?: string;
}
