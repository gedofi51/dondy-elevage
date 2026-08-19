import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListBatchLineageQueryDto {
  @IsOptional()
  @IsUUID('4')
  incubationBatchId?: string;

  @IsOptional()
  @IsString()
  childType?: string;

  @IsOptional()
  @IsUUID('4')
  childId?: string;
}
