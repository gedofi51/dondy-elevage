import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** Tous les champs de mesure sont optionnels ("si mesurable", cahier V6
 * §5) — le service rejette une saisie totalement vide (aucun champ
 * renseigné) plutôt que d'accepter une ligne inutile. */
export class CreateWaterInfrastructureReadingDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pumpedVolumeM3?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reservoirLevelPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pumpHoursCumulative?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  farmInternalConsumptionM3?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
