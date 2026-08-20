import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/** Pas de `date` : clé métier immuable une fois la journée créée, comme
 * `dayNumber` côté BroilerDailyRecord. */
export class UpdateDailyRecordDto {
  /** Phase 7 — additif. Nullable explicitement (voir
   * BroilerDailyRecord.UpdateDailyRecordDto.feedItemId). */
  @IsOptional()
  @IsUUID('4')
  feedItemId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  henCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  mortalityQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cullsQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  otherExitsQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsLaid?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsBroken?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsRejected?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feedDistributedKg?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
