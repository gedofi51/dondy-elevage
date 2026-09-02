import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AlertSeverity, AlertStatus } from '@prisma/client';

export class ListAlertsQueryDto {
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  /** Filtre par préfixe de `type` (ex. "anomalie_croisee_broiler_") — pas
   * une égalité stricte : les types d'alerte embarquent souvent un
   * suffixe variable (jour/date, voir batch_high_mortality_j{N} et les
   * anomalies croisées du Lot 4), une égalité stricte ne matcherait
   * jamais rien au-delà d'un seul jour précis. Ajouté pour l'écran
   * Anomalies (Lot 4) — extension de l'endpoint existant, pas un nouveau
   * mécanisme parallèle. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  typePrefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
