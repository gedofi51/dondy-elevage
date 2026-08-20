import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { WaterPointStatus } from '@prisma/client';

/** `code` non modifiable (identité permanente du point). `initialIndex`
 * modifiable seulement si aucun WaterReading n'existe encore pour ce
 * point — vérifié en service, pas ici (dépend de l'état en base). */
export class UpdateWaterPointDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  meterReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tariffFcfaPerM3?: number;

  @IsOptional()
  @IsUUID('4')
  responsibleId?: string;

  @IsOptional()
  @IsEnum(WaterPointStatus)
  status?: WaterPointStatus;
}
