import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdateIncubatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacityEggs?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
