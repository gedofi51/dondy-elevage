import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { SaleMode, SaleProductType, SaleStatus } from '@prisma/client';

export class CreateSaleDto {
  /** Optionnel, défaut POULET_CHAIR si omis (même défaut que
   * Sale.productType en base) — préserve la compatibilité des appelants
   * antérieurs à la Phase 4, qui ne connaissent pas ce champ. */
  @IsOptional()
  @IsEnum(SaleProductType)
  productType?: SaleProductType;

  /** Requis si productType = POULET_CHAIR (vérifié en service, pas ici —
   * dépend d'un autre champ, comme CreateBroilerBatchDto.supplierId). */
  @ValidateIf((dto: CreateSaleDto) => (dto.productType ?? 'POULET_CHAIR') === 'POULET_CHAIR')
  @IsUUID('4')
  batchId?: string;

  /** Requis si productType = OEUFS. */
  @ValidateIf((dto: CreateSaleDto) => dto.productType === 'OEUFS')
  @IsUUID('4')
  layerBatchId?: string;

  /** Requis si productType = POUSSINS. */
  @ValidateIf((dto: CreateSaleDto) => dto.productType === 'POUSSINS')
  @IsUUID('4')
  chickBatchId?: string;

  /** Requis si productType = EAU (vérifié aussi en service). */
  @ValidateIf((dto: CreateSaleDto) => dto.productType === 'EAU')
  @IsUUID('4')
  waterPointId?: string;

  @IsDateString()
  date!: string;

  /** Requis sauf si productType = EAU — §7.4 : "vente anonyme comptoir,
   * sans création obligatoire de client". Seul productType autorisant une
   * vente sans client identifié (POULET_CHAIR/OEUFS/POUSSINS restent
   * inchangés, toujours requis). */
  @ValidateIf((dto: CreateSaleDto) => dto.productType !== 'EAU')
  @IsUUID('4')
  customerId?: string;

  /** Défaut = utilisateur courant si omis. */
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @IsEnum(SaleMode)
  saleMode!: SaleMode;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsInt()
  @Min(0)
  unitPriceFcfa!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountFcfa?: number;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsString()
  observation?: string;
}
