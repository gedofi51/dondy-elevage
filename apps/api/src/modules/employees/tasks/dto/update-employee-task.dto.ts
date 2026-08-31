import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { EmployeeTaskStatus } from '@prisma/client';
import { EMPLOYEE_TASK_EDITABLE_STATUSES } from '../employee-tasks.validation';

/**
 * `status` n'accepte que les valeurs "libres" (A_FAIRE/EN_COURS/
 * REALISEE) — `@IsIn(EMPLOYEE_TASK_EDITABLE_STATUSES)`, pas `@IsEnum`
 * sur l'énumération Prisma complète. ANNULEE reste un statut terminal
 * atteignable uniquement via POST .../annuler — même discipline que
 * UpdateMaintenanceTaskDto (adaptée : REALISEE, elle, reste directement
 * accessible ici faute d'équivalent à MaintenanceIntervention — voir
 * employee-tasks.validation.ts).
 */
export class UpdateEmployeeTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  designation?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(EMPLOYEE_TASK_EDITABLE_STATUSES)
  status?: EmployeeTaskStatus;

  @IsOptional()
  @IsString()
  observations?: string;
}
