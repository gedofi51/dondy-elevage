import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Bloqué en service (assertAdvanceEditable) une fois l'avance déduite
 * d'un relevé de paie — voir salary-advances.validation.ts. */
export class UpdateSalaryAdvanceDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountFcfa?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
