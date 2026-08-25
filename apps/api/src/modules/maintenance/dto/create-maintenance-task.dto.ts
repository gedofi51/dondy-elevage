import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Création manuelle uniquement — planId reste toujours null pour une
 * tâche créée par ce endpoint. Les tâches préventives sont générées par
 * le système (MaintenancePlansService/MaintenanceTaskGenerationService),
 * jamais par ce endpoint — voir DETTE_TECHNIQUE.md Phase 17. */
export class CreateMaintenanceTaskDto {
  @IsUUID('4')
  assetId!: string;

  @IsIn(['CORRECTIVE', 'CONDITIONNELLE'])
  type!: 'CORRECTIVE' | 'CONDITIONNELLE';

  @IsString()
  @MaxLength(191)
  designation!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
