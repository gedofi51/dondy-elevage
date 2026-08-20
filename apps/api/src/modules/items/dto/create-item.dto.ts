import { IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MaxLength(191)
  name!: string;

  @IsString()
  @MaxLength(191)
  category!: string;

  @IsString()
  @MaxLength(191)
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minThreshold?: number;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;
}
