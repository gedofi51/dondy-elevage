import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Pas de `date` : clé métier immuable une fois le relevé créé. Toute
 * correction (index, consommation, encaissement) repasse par les mêmes
 * contrôles §7.3 en service (400/409 selon le cas) — voir
 * WaterReadingsService.update(). */
export class UpdateWaterReadingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  indexMatin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  indexSoir?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumptionM3?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cashAmountFcfa?: number;

  @IsOptional()
  @IsString()
  indexAnomalyReason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
