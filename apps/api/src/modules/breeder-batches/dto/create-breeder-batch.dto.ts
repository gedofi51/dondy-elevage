import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateBreederBatchDto {
  @IsOptional()
  @IsString()
  strain?: string;

  @IsDateString()
  constitutionDate!: string;

  @IsInt()
  @Min(1)
  femaleCount!: number;

  @IsInt()
  @Min(0)
  maleCount!: number;

  @IsUUID('4')
  buildingId!: string;

  @IsUUID('4')
  primaryManagerId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observations?: string;
}
