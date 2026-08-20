import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateWaterReadingDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0)
  indexMatin!: number;

  @IsNumber()
  @Min(0)
  indexSoir!: number;

  /** Requis uniquement si indexSoir < indexMatin (anomalie documentée,
   * §7.3) : le service ne dérive plus automatiquement la consommation
   * dans ce cas — override manuel explicite, jamais un plafond
   * silencieux à 0 (voir plan Phase 6, section B.1). */
  @ValidateIf((dto: CreateWaterReadingDto) => dto.indexSoir < dto.indexMatin)
  @IsNumber()
  @Min(0)
  consumptionM3?: number;

  /** Requis si indexSoir < indexMatin (400, vérifié ici et en service) OU
   * si indexMatin ne correspond pas au dernier index soir validé du point
   * (409, vérifiable uniquement en service — dépend de l'état en base).
   * Laissé optionnel ici : la service tranche les deux cas. */
  @IsOptional()
  @IsString()
  indexAnomalyReason?: string;

  @IsInt()
  @Min(0)
  cashAmountFcfa!: number;

  /** Requis (non vide) si l'écart théorique/encaissé calculé par le
   * service est non nul (§7.3) — vérifié en service, pas ici (dépend du
   * tarif du point et du calcul serveur, non connus du DTO). */
  @IsOptional()
  @IsString()
  remarks?: string;
}
