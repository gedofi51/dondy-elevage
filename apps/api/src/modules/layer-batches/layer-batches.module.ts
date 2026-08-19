import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { LayerBatchesController } from './layer-batches.controller';
import { LayerBatchesService } from './layer-batches.service';
import { LayerAlertsCronService } from './layer-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [LayerBatchesController],
  providers: [LayerBatchesService, LayerAlertsCronService],
  exports: [LayerBatchesService],
})
export class LayerBatchesModule {}
