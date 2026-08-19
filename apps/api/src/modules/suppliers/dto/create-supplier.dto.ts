import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MaxLength(191)
  name!: string;

  @IsString()
  @MaxLength(64)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
