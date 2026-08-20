import { IsDateString } from 'class-validator';

/** Même principe que GetWaterPointKpiQueryDto (Phase 6) : période explicite,
 * pas de défaut implicite. */
export class GetTreasuryPeriodQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
