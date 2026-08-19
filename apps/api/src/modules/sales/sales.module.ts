import { Module } from '@nestjs/common';
import { BroilerBatchesModule } from '../broiler-batches/broiler-batches.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [BroilerBatchesModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
