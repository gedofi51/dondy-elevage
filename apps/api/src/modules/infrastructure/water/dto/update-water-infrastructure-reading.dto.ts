import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateWaterInfrastructureReadingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  pumpedVolumeM3?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reservoirLevelPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pumpHoursCumulative?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  farmInternalConsumptionM3?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
