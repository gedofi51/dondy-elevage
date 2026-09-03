import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

/** Score de performance (Lot 5) — voir
 * broiler-batches/dto/update-broiler-performance-coefficients.dto.ts pour
 * la justification du choix (champs nommés vs map dynamique). Couvoir :
 * pas de `target` (éclosion/fécondité sont déjà des taux 0-100 naturels). */
export class PerformanceScoreCoefficientDto {
  @IsNumber()
  @Min(0)
  weight!: number;
}

export class UpdateIncubationPerformanceCoefficientsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PerformanceScoreCoefficientDto)
  hatchRate?: PerformanceScoreCoefficientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PerformanceScoreCoefficientDto)
  fertilityRate?: PerformanceScoreCoefficientDto;
}
