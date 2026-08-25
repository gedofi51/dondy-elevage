import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateMaintenancePlanDto {
  @IsUUID('4')
  assetId!: string;

  @IsString()
  @MaxLength(191)
  designation!: string;

  /** Aucune unité donnée par le cahier V6 §7 — hypothèse d'ingénierie
   * documentée, voir DETTE_TECHNIQUE.md Phase 17. */
  @IsInt()
  @Min(1)
  periodicityDays!: number;

  /** Échéance de la première tâche, générée directement à cette date (pas
   * de calcul de prorata comme pour l'amortissement). */
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
