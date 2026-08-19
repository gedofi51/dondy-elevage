import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateIncubationBatchDto {
  @IsUUID('4')
  breederBatchId!: string;

  @IsUUID('4')
  incubatorId!: string;

  @IsDateString()
  incubationStartDate!: string;

  @IsInt()
  @Min(1)
  eggCount!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
