import { IsOptional, IsUUID } from 'class-validator';

export class ListStockMovementsQueryDto {
  @IsOptional()
  @IsUUID('4')
  itemId?: string;
}
