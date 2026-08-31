import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [EmployeesModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
