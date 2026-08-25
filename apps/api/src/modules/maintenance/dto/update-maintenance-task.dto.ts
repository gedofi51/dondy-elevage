import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  MAINTENANCE_TASK_EDITABLE_STATUSES,
  type MaintenanceTaskStatus,
} from '@dondy-elevage/shared-types';

/**
 * `status` n'accepte QUE les valeurs "libres" (A_FAIRE/EN_COURS) —
 * `@IsIn(MAINTENANCE_TASK_EDITABLE_STATUSES)`, pas `@IsEnum` sur
 * l'énumération Prisma complète. REALISEE/ANNULEE restent des statuts
 * terminaux atteignables uniquement via la création d'une
 * MaintenanceIntervention (taskId fourni) et
 * POST /maintenance-tasks/:id/annuler — même discipline que
 * UpdateAssetDto (Phase 16, décision C.5).
 */
export class UpdateMaintenanceTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  designation?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(MAINTENANCE_TASK_EDITABLE_STATUSES)
  status?: MaintenanceTaskStatus;

  @IsOptional()
  @IsString()
  observations?: string;
}
