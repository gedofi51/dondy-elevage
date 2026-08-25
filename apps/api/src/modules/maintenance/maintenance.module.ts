import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { MaintenancePlansController } from './maintenance-plans.controller';
import { MaintenancePlansService } from './maintenance-plans.service';
import { MaintenanceTasksController } from './maintenance-tasks.controller';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { MaintenanceInterventionsController } from './maintenance-interventions.controller';
import { MaintenanceInterventionsService } from './maintenance-interventions.service';
import { MaintenanceTaskGenerationService } from './maintenance-task-generation.service';
import { MaintenanceTasksGenerationCronService } from './maintenance-tasks-generation.cron';
import { MaintenanceAlertsCronService } from './maintenance-alerts.cron';

@Module({
  imports: [AlertsModule, StockMovementsModule],
  controllers: [
    MaintenancePlansController,
    MaintenanceTasksController,
    MaintenanceInterventionsController,
  ],
  providers: [
    MaintenancePlansService,
    MaintenanceTasksService,
    MaintenanceInterventionsService,
    MaintenanceTaskGenerationService,
    MaintenanceTasksGenerationCronService,
    MaintenanceAlertsCronService,
  ],
  exports: [MaintenancePlansService, MaintenanceTasksService, MaintenanceInterventionsService],
})
export class MaintenanceModule {}
