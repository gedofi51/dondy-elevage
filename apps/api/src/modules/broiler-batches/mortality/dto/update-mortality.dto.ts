import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MortalityCause } from '@prisma/client';

export class UpdateMortalityDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  dayNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsEnum(MortalityCause)
  cause?: MortalityCause;

  @IsOptional()
  @IsString()
  observation?: string;
}
