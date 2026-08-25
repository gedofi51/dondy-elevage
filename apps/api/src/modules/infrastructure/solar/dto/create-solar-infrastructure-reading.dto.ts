import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** Tous les champs de mesure sont optionnels ("si disponible", cahier V6
 * §4) — le service rejette une saisie totalement vide. */
export class CreateSolarInfrastructureReadingDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyProductionKwh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryChargePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  instantaneousPowerKw?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
