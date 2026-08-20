import { Module } from '@nestjs/common';
import { WaterPointsModule } from '../water-points.module';
import { WaterReadingsController } from './water-readings.controller';
import { WaterReadingsService } from './water-readings.service';

@Module({
  imports: [WaterPointsModule],
  controllers: [WaterReadingsController],
  providers: [WaterReadingsService],
})
export class WaterReadingsModule {}
