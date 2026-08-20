import { IsOptional, IsUUID } from 'class-validator';

export class ListSupplierPaymentsQueryDto {
  @IsOptional()
  @IsUUID('4')
  purchaseOrderId?: string;
}
