import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { BroilerBatchesController } from './broiler-batches.controller';
import { BroilerBatchesService } from './broiler-batches.service';
import { BroilerAlertsCronService } from './broiler-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [BroilerBatchesController],
  providers: [BroilerBatchesService, BroilerAlertsCronService],
  exports: [BroilerBatchesService],
})
export class BroilerBatchesModule {}
