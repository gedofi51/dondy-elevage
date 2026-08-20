import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';

/** Pas de `supplierId`/`items` modifiables : filiation et lignes figées à
 * la création (comme IncubationBatch.breederBatchId/eggCount) — une
 * commande erronée s'annule et se recrée. `status` limité en service à la
 * transition BROUILLON -> COMMANDE (PARTIELLEMENT_RECU/RECU dérivés
 * automatiquement des réceptions, ANNULE via l'endpoint dédié). */
export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  observation?: string;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}
