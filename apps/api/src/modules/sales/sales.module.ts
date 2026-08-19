import { Module } from '@nestjs/common';
import { BroilerBatchesModule } from '../broiler-batches/broiler-batches.module';
import { LayerBatchesModule } from '../layer-batches/layer-batches.module';
import { EggStockModule } from '../egg-stock/egg-stock.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [BroilerBatchesModule, LayerBatchesModule, EggStockModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
