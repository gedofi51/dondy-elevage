import { Module } from '@nestjs/common';
import { ChickBatchesController } from './chick-batches.controller';
import { ChickBatchesService } from './chick-batches.service';

@Module({
  controllers: [ChickBatchesController],
  providers: [ChickBatchesService],
  exports: [ChickBatchesService],
})
export class ChickBatchesModule {}
