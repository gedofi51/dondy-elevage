import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDailyRecordDto {
  @IsDateString()
  date!: string;

  /** Optionnel : si omis, le service calcule une suggestion (veille - sorties
   * de la veille, ou effectif initial du lot pour la toute première journée)
   * — §5.2 "calcul + ajustement contrôlé". */
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

  @IsInt()
  @Min(0)
  eggsLaid!: number;

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
