import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AlertSeverity } from '@prisma/client';

export class CreateAlertDto {
  /** Code libre (ex. "tache_en_retard") — les futures règles métier
   * ajouteront leurs propres types, pas un enum figé. */
  @IsString()
  @MaxLength(64)
  type!: string;

  @IsEnum(AlertSeverity)
  severity!: AlertSeverity;

  @IsString()
  @MaxLength(191)
  title!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  entityId?: string;

  /** Omis ou passé/immédiat = déclenchement direct dès la création (aucun
   * ordonnanceur cette phase). Futur = reste en CREATED jusqu'à un
   * déclenchement manuel via POST /alerts/:id/declencher. */
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
