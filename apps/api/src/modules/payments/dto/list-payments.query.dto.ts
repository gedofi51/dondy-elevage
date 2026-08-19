import { IsOptional, IsUUID } from 'class-validator';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsUUID('4')
  saleId?: string;
}
