import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { WaterInfrastructureReadingsController } from './water/water-infrastructure-readings.controller';
import { WaterInfrastructureReadingsService } from './water/water-infrastructure-readings.service';
import { SolarInfrastructureReadingsController } from './solar/solar-infrastructure-readings.controller';
import { SolarInfrastructureReadingsService } from './solar/solar-infrastructure-readings.service';
import { NetworkStatusReadingsController } from './network/network-status-readings.controller';
import { NetworkStatusReadingsService } from './network/network-status-readings.service';
import { InfrastructureAlertsCronService } from './infrastructure-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [
    WaterInfrastructureReadingsController,
    SolarInfrastructureReadingsController,
    NetworkStatusReadingsController,
  ],
  providers: [
    WaterInfrastructureReadingsService,
    SolarInfrastructureReadingsService,
    NetworkStatusReadingsService,
    InfrastructureAlertsCronService,
  ],
  exports: [
    WaterInfrastructureReadingsService,
    SolarInfrastructureReadingsService,
    NetworkStatusReadingsService,
  ],
})
export class InfrastructureModule {}
