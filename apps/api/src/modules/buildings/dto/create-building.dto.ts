import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateBuildingDto {
  @IsString()
  @MaxLength(191)
  name!: string;

  @IsString()
  @MaxLength(64)
  type!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;
}
