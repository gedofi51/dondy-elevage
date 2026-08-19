import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  entityId?: string;
}
