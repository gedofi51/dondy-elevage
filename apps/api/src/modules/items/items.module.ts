import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ItemsAlertsCronService } from './items-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsAlertsCronService],
  exports: [ItemsService],
})
export class ItemsModule {}
