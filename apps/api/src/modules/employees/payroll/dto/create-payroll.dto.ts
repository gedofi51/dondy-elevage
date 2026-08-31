import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * `employeeId` absent : porté par la route (`/employees/:employeeId/
 * payroll`). `baseSalaryFcfa` absent : capturé en instantané depuis
 * Employee.baseSalaryFcfa au moment de la génération (voir
 * PayrollService — intention déjà documentée en commentaire de
 * schema.prisma depuis le Lot 1). `netFcfa` absent : calculé, jamais
 * fourni par le client. `status` absent : toujours BROUILLON à la
 * création (défaut schema.prisma).
 */
export class CreatePayrollDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deductionsFcfa?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
