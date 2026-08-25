import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetsAlertsCronService } from './assets-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetsAlertsCronService],
  exports: [AssetsService],
})
export class AssetsModule {}
