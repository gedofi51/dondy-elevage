import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

/**
 * Score de performance (Lot 5) — un champ nommé par composante plutôt
 * qu'une map dynamique `Record<string, ...>` : les composantes Chair sont
 * fixes et connues (mortalité/IC/GMQ), donc class-validator peut les
 * valider individuellement — cohérent avec la doctrine du projet ("pas de
 * mécanisme générique", voir DETTE_TECHNIQUE.md). `forbidNonWhitelisted`
 * (main.ts) rejette déjà toute clé inconnue en 400, sans code
 * supplémentaire ici.
 */
export class PerformanceScoreCoefficientDto {
  @IsNumber()
  @Min(0)
  weight!: number;

  /** Uniquement pour IC/GMQ — absent = composante exclue du score (voir
   * broiler-performance-score.calculations.ts). `> 0` obligatoire, une
   * cible nulle ou négative n'a pas de sens zootechnique. */
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  target?: number;
}

export class UpdateBroilerPerformanceCoefficientsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PerformanceScoreCoefficientDto)
  mortality?: PerformanceScoreCoefficientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PerformanceScoreCoefficientDto)
  ic?: PerformanceScoreCoefficientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PerformanceScoreCoefficientDto)
  gmq?: PerformanceScoreCoefficientDto;
}
