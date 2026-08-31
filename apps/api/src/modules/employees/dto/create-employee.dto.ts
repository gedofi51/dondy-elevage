import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

/**
 * `code` (matricule) absent volontairement : auto-généré par le service
 * (même patron que Asset.code/BroilerBatch.code — voir
 * EmployeesService.generateCode()), jamais fourni par le client.
 * `status` absent : toujours ACTIF à la création (défaut schema.prisma),
 * la réactivation/suspension passe par PATCH (voir UpdateEmployeeDto).
 */
export class CreateEmployeeDto {
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;

  @IsOptional()
  @IsUUID('4')
  managerId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  position!: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsDateString()
  hireDate!: string;

  /** Cross-field endDate >= hireDate : validé en service (même
   * discipline que Asset.serviceDate >= purchaseDate — voir
   * DETTE_TECHNIQUE.md Phase 20), pas de ValidatorConstraint custom
   * introduit pour ce seul cas, sans précédent dans le projet. */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsInt()
  @Min(0)
  baseSalaryFcfa!: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
