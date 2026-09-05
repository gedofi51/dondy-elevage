import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBlockDto {
  @IsUUID('4')
  buildingId!: string;

  @IsString()
  @MaxLength(191)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}
