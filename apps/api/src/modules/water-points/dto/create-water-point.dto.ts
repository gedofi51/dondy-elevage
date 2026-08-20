import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

export class CreateWaterPointDto {
  @IsString()
  @MaxLength(191)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  meterReference?: string;

  @IsNumber()
  @Min(0)
  initialIndex!: number;

  @IsInt()
  @Min(0)
  tariffFcfaPerM3!: number;

  @IsUUID('4')
  responsibleId!: string;
}
