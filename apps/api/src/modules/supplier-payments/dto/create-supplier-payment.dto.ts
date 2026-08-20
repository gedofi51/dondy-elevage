import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateSupplierPaymentDto {
  @IsUUID('4')
  purchaseOrderId!: string;

  @IsDateString()
  date!: string;

  /** Paramétrable, texte libre — même principe que Payment.method. */
  @IsString()
  @MinLength(1)
  method!: string;

  @IsInt()
  @Min(1)
  amountFcfa!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  observation?: string;
}
