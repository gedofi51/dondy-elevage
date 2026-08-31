import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * `status` n'accepte que 'VALIDE' — passer de BROUILLON à BROUILLON est
 * un no-op sans intérêt, et aucun retour en arrière depuis VALIDE n'est
 * possible (statut terminal, voir payroll.validation.ts). `periodStart`/
 * `periodEnd`/`baseSalaryFcfa`/`netFcfa` absents : immuables après
 * création (le "relevé suivant" corrige, ne réécrit jamais un relevé
 * existant).
 */
export class UpdatePayrollDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  bonusFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deductionsFcfa?: number;

  @IsOptional()
  @IsIn(['VALIDE'])
  status?: 'VALIDE';

  @IsOptional()
  @IsString()
  observations?: string;
}
