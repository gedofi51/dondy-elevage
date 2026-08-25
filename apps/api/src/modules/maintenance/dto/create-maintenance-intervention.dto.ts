import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class MaintenanceInterventionPartDto {
  @IsUUID('4')
  itemId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

/**
 * `taskId` optionnel — rattachée à une tâche existante (la clôture en
 * REALISEE est alors un effet de bord transactionnel, voir
 * MaintenanceTasksService.markRealizedInTransaction) ou directe sur un
 * actif (réparation effectuée sans planification préalable). `parts` :
 * chaque pièce déclenche un mouvement de stock (SORTIE, reason=MAINTENANCE)
 * + une Expense automatique — voir MaintenanceInterventionsService.create().
 */
export class CreateMaintenanceInterventionDto {
  @IsUUID('4')
  assetId!: string;

  @IsOptional()
  @IsUUID('4')
  taskId?: string;

  @IsDateString()
  interventionDate!: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  laborCostFcfa?: number;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MaintenanceInterventionPartDto)
  parts?: MaintenanceInterventionPartDto[];
}
