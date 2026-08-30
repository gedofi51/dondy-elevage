import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees.module';
import { SalaryAdvancesController } from './salary-advances.controller';
import { SalaryAdvancesService } from './salary-advances.service';

@Module({
  imports: [EmployeesModule],
  controllers: [SalaryAdvancesController],
  providers: [SalaryAdvancesService],
})
export class SalaryAdvancesModule {}
