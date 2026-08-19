import { Module } from '@nestjs/common';
import { BroilerBatchesModule } from '../../broiler-batches/broiler-batches.module';
import { ChickBatchesModule } from '../../chick-batches/chick-batches.module';
import { OrientationController } from './orientation.controller';
import { OrientationService } from './orientation.service';

@Module({
  imports: [BroilerBatchesModule, ChickBatchesModule],
  controllers: [OrientationController],
  providers: [OrientationService],
})
export class OrientationModule {}
