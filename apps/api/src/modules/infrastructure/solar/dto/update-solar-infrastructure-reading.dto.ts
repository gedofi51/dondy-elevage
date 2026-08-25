import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSolarInfrastructureReadingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyProductionKwh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryChargePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  instantaneousPowerKw?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
