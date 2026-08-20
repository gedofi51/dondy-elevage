import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { WaterPointsController } from './water-points.controller';
import { WaterPointsService } from './water-points.service';
import { WaterAlertsCronService } from './water-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [WaterPointsController],
  providers: [WaterPointsService, WaterAlertsCronService],
  exports: [WaterPointsService],
})
export class WaterPointsModule {}
