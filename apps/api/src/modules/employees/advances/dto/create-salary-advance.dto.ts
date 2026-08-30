import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** `employeeId` absent : porté par la route (`/employees/:employeeId/
 * advances`). `deductedInPayrollId` absent : jamais fourni par le
 * client, renseigné automatiquement par PayrollService à la création du
 * relevé qui la déduit (voir payroll.calculations.ts). */
export class CreateSalaryAdvanceDto {
  @IsDateString()
  date!: string;

  @IsInt()
  @Min(1)
  amountFcfa!: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
