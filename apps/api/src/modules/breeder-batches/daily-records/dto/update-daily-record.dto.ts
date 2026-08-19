import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Pas de `date` : clé métier immuable une fois la journée créée. */
export class UpdateDailyRecordDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  eggsLaid?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsSelectedForIncubation?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsRejected?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eggsSold?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
