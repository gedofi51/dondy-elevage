import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SaleStatus } from '@prisma/client';

export class ListSalesQueryDto {
  @IsOptional()
  @IsUUID('4')
  batchId?: string;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}
