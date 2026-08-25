import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** `assetId`/`startDate` volontairement absents — immuables après création
 * (le point de départ du calcul de prochaine échéance ne doit jamais
 * bouger rétroactivement). `active` = simple bascule libre (pas un statut
 * terminal) : désactiver arrête la génération de tâches (voir
 * MaintenanceTaskGenerationService), sans empêcher la réactivation. */
export class UpdateMaintenancePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  designation?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodicityDays?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  observations?: string;
}
