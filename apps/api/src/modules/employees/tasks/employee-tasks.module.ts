import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees.module';
import { EmployeeTasksController } from './employee-tasks.controller';
import { EmployeeTasksService } from './employee-tasks.service';

@Module({
  imports: [EmployeesModule],
  controllers: [EmployeeTasksController],
  providers: [EmployeeTasksService],
})
export class EmployeeTasksModule {}
