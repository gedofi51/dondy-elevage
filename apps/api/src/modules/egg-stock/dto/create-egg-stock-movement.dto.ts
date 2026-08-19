import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EggStockMovementType } from '@prisma/client';

/** SORTIE_VENTE et ENTREE_ANNULATION sont gérés exclusivement par le
 * service (via SalesService) — le service revalide que `type` fait partie
 * de cette liste, cette saisie manuelle ne peut pas les emprunter. */
export class CreateEggStockMovementDto {
  @IsUUID('4')
  lotId!: string;

  @IsEnum(EggStockMovementType)
  type!: EggStockMovementType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
