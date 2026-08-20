import { Module } from '@nestjs/common';
import { WaterPointsController } from './water-points.controller';
import { WaterPointsService } from './water-points.service';

@Module({
  controllers: [WaterPointsController],
  providers: [WaterPointsService],
  exports: [WaterPointsService],
})
export class WaterPointsModule {}
