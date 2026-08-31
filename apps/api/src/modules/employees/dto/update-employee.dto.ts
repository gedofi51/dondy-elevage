import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

/**
 * `code` absent — immuable après création (même discipline que
 * purchaseDate/serviceDate sur Asset). Les 4 valeurs d'EmployeeStatus
 * sont toutes acceptables ici (contrairement à AssetStatus/REFORME,
 * jamais explicite dans un PATCH générique) : SUSPENDU/DEPART doivent
 * pouvoir être *posés* par un gestionnaire, la restriction porte sur ce
 * qui reste modifiable UNE FOIS l'employé déjà SUSPENDU/DEPART — logique
 * dynamique dépendant de l'état courant, pas exprimable en simple liste
 * de valeurs autorisées (`@IsIn`) : voir
 * EmployeesService.assertUpdateAllowed()/employees.validation.ts.
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;

  @IsOptional()
  @IsUUID('4')
  managerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  position?: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseSalaryFcfa?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
