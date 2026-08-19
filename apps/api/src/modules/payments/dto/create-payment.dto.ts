import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID('4')
  saleId!: string;

  @IsDateString()
  date!: string;

  /** Paramétrable, texte libre (§10.4 : "les moyens réellement utilisés par
   * l'exploitation seront paramétrables"). */
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
