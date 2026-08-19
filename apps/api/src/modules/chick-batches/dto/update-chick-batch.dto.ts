import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ChickBatchStatus } from '@prisma/client';

/** Pas de `purpose`/`initialQuantity` modifiables : un ChickBatch naît
 * toujours d'une orientation, ses quantités d'origine ne se corrigent pas
 * rétroactivement. */
export class UpdateChickBatchDto {
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;

  @IsOptional()
  @IsEnum(ChickBatchStatus)
  status?: ChickBatchStatus;
}
