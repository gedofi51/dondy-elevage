import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** `employeeId` absent : porté par la route (`/employees/:employeeId/
 * tasks`), même patron que CreateAttendanceDto. `status` absent : toujours
 * A_FAIRE à la création (défaut schema.prisma). */
export class CreateEmployeeTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  designation!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
