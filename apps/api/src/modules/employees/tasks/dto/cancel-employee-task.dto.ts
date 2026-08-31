import { IsOptional, IsString } from 'class-validator';

/** Même forme que CancelMaintenanceTaskDto. */
export class CancelEmployeeTaskDto {
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
