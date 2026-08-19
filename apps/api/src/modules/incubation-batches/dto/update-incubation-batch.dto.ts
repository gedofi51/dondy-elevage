import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { IncubationBatchStatus } from '@prisma/client';

/** Pas de `breederBatchId`/`eggCount` modifiables : filiation et quantité
 * incubée figées à la création — une correction se ferait par annulation
 * + nouveau lot, jamais par édition rétroactive d'une donnée déjà engagée. */
export class UpdateIncubationBatchDto {
  @IsOptional()
  @IsUUID('4')
  incubatorId?: string;

  @IsOptional()
  @IsDateString()
  incubationStartDate?: string;

  @IsOptional()
  @IsDateString()
  actualHatchDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsInfertile?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsInfected?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  embryonicMortality?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  chicksHatched?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  /** Transition libre EN_INCUBATION -> ECLOS — ANNULEE et CLOTURE passent
   * par les endpoints dédiés (annuler/cloturer). */
  @IsOptional()
  @IsEnum(IncubationBatchStatus)
  status?: IncubationBatchStatus;
}
