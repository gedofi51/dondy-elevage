import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReformAssetDto {
  @IsOptional()
  @IsDateString()
  reformDate?: string;

  @IsOptional()
  @IsString()
  reformReason?: string;
}
