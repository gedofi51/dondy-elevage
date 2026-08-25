import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MaxLength(191)
  designation!: string;

  @IsString()
  @MaxLength(191)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  serialNumber?: string;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @IsDateString()
  purchaseDate!: string;

  /** Point de départ du plan d'amortissement, requis dès la création — voir
   * DETTE_TECHNIQUE.md Phase 16, décision C.1. */
  @IsDateString()
  serviceDate!: string;

  @IsInt()
  @Min(0)
  purchasePriceFcfa!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  installationCostFcfa?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  location?: string;

  @IsUUID('4')
  responsibleId!: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  residualValueFcfa?: number;

  @IsInt()
  @Min(1)
  depreciationDurationYears!: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
