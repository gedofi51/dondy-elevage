import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListItemsQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  /** Filtre sur le statut dérivé (ORANGE/ROUGE) — "Stocks critiques" du
   * tableau de bord §9, pas d'endpoint d'agrégation dédié nécessaire. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  belowThreshold?: boolean;
}
