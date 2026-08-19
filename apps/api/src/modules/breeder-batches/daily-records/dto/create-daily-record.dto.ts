import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDailyRecordDto {
  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  eggsLaid!: number;

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
