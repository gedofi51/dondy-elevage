import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { StockMovementReason, StockMovementType } from '@prisma/client';

/** Saisie manuelle uniquement — ACHAT (GoodsReceipt) et DISTRIBUTION_BANDE
 * (hooks daily-records/health-events) sont exclusivement gérés par leurs
 * flux dédiés, jamais via cet endpoint (voir StockMovementsService.create,
 * même discipline que EggStockService.MANUAL_MOVEMENT_TYPES). */
export class CreateStockMovementDto {
  @IsUUID('4')
  itemId!: string;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @IsEnum(StockMovementReason)
  reason!: StockMovementReason;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsDateString()
  date!: string;

  /** Requis pour reason=ACHAT/PRODUCTION_INTERNE (coût réinjecté dans le
   * CUMP) — RETOUR/AJUSTEMENT valorisent au CUMP courant, ignoré si fourni. */
  @ValidateIf(
    (dto: CreateStockMovementDto) => dto.reason === 'ACHAT' || dto.reason === 'PRODUCTION_INTERNE',
  )
  @IsInt()
  @Min(0)
  unitCostFcfa?: number;

  /** Requis si reason=AJUSTEMENT (§15). */
  @ValidateIf((dto: CreateStockMovementDto) => dto.reason === 'AJUSTEMENT')
  @IsString()
  justification?: string;
}
