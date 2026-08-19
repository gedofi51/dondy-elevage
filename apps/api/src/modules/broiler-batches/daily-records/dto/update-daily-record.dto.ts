import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDailyRecordDto {
  @IsOptional()
  @IsString()
  entryTime?: string;

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
  @IsString()
  feedType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feedDistributedKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feedRemainingKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  feedBagsUsed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waterConsumptionLiters?: number;

  @IsOptional()
  @IsString()
  waterObservation?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sampleSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalSampleWeightG?: number;

  @IsOptional()
  @IsNumber()
  temperatureMinC?: number;

  @IsOptional()
  @IsNumber()
  temperatureMaxC?: number;

  @IsOptional()
  @IsNumber()
  temperatureNowC?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  humidityPercent?: number;

  @IsOptional()
  @IsString()
  symptoms?: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsString()
  vaccination?: string;

  @IsOptional()
  @IsString()
  healthProduct?: string;

  @IsOptional()
  @IsString()
  healthQuantity?: string;

  @IsOptional()
  @IsString()
  healthResponsible?: string;

  @IsOptional()
  @IsBoolean()
  behaviorNormal?: boolean;

  @IsOptional()
  @IsBoolean()
  behaviorLowConsumption?: boolean;

  @IsOptional()
  @IsBoolean()
  behaviorAgitation?: boolean;

  @IsOptional()
  @IsBoolean()
  behaviorFlocking?: boolean;

  @IsOptional()
  @IsBoolean()
  behaviorLethargy?: boolean;

  @IsOptional()
  @IsBoolean()
  behaviorDiarrhea?: boolean;

  @IsOptional()
  @IsBoolean()
  behaviorRespiratoryDistress?: boolean;

  @IsOptional()
  @IsString()
  behaviorOther?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
