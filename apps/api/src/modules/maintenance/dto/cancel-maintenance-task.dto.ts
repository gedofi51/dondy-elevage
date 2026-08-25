import { IsOptional, IsString } from 'class-validator';

export class CancelMaintenanceTaskDto {
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
