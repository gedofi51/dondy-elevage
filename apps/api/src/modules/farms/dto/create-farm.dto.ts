import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFarmDto {
  @IsString()
  @MaxLength(191)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  locality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
