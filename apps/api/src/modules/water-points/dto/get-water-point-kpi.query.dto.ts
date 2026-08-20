import { IsDateString } from 'class-validator';

/** Période explicite, pas de défaut implicite (ex. "30 derniers jours") —
 * plus simple et sans ambiguïté pour une première version de ce KPI. */
export class GetWaterPointKpiQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
