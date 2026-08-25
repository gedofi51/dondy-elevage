import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ASSET_EDITABLE_STATUSES, type AssetStatus } from '@dondy-elevage/shared-types';

/**
 * Les paramètres qui définissent le plan d'amortissement déjà généré
 * (purchaseDate/serviceDate/purchasePriceFcfa/installationCostFcfa/
 * residualValueFcfa/depreciationDurationYears) sont volontairement absents
 * — immuables après création (même discipline que
 * currentStock/averageUnitCostFcfa sur Item).
 *
 * `status` n'accepte QUE les valeurs "libres" (ACTIF/HORS_SERVICE) —
 * `@IsIn(ASSET_EDITABLE_STATUSES)`, pas `@IsEnum(AssetStatus)` sur
 * l'énumération Prisma complète. REFORME reste un statut terminal
 * atteignable UNIQUEMENT via POST /assets/:id/reformer — application
 * délibérée de la leçon déjà tirée de la dette transversale "statuts
 * terminaux non protégés" (4 modules d'élevage, Phase 11), pas répétée
 * ici (voir DETTE_TECHNIQUE.md Phase 16, décision C.5).
 */
export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  category?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(191)
  location?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleId?: string;

  @IsOptional()
  @IsIn(ASSET_EDITABLE_STATUSES)
  status?: AssetStatus;

  @IsOptional()
  @IsDateString()
  warrantyExpiresAt?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
