import { Module } from '@nestjs/common';
import { EggStockController } from './egg-stock.controller';
import { EggStockService } from './egg-stock.service';

@Module({
  controllers: [EggStockController],
  providers: [EggStockService],
  exports: [EggStockService],
})
export class EggStockModule {}
