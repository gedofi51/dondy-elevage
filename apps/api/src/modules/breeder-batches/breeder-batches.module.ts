import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { BreederBatchesController } from './breeder-batches.controller';
import { BreederBatchesService } from './breeder-batches.service';
import { BreederAlertsCronService } from './breeder-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [BreederBatchesController],
  providers: [BreederBatchesService, BreederAlertsCronService],
  exports: [BreederBatchesService],
})
export class BreederBatchesModule {}
