import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateIf } from 'class-validator';
import { ChickTransformationType } from '@prisma/client';

export class CreateOrientationDto {
  @IsEnum(ChickTransformationType)
  transformationType!: ChickTransformationType;

  @IsInt()
  @Min(1)
  quantity!: number;

  /** Requis pour CHAIR (bâtiment de la nouvelle bande) et RENOUVELLEMENT
   * (housing de l'élevage de renouvellement) — vérifié en service. */
  @ValidateIf(
    (dto: CreateOrientationDto) =>
      dto.transformationType === 'CHAIR' || dto.transformationType === 'RENOUVELLEMENT',
  )
  @IsUUID('4')
  buildingId?: string;

  /** Requis pour CHAIR uniquement (responsable de la nouvelle bande). */
  @ValidateIf((dto: CreateOrientationDto) => dto.transformationType === 'CHAIR')
  @IsUUID('4')
  primaryManagerId?: string;

  /** Requis pour REFORME_PERTE uniquement (motif de sortie). */
  @ValidateIf((dto: CreateOrientationDto) => dto.transformationType === 'REFORME_PERTE')
  @IsString()
  @MinLength(1)
  reason?: string;
}
