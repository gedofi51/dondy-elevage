import { Module } from '@nestjs/common';
import { StockMovementsModule } from '../../stock-movements/stock-movements.module';
import { DailyRecordsController } from './daily-records.controller';
import { DailyRecordsService } from './daily-records.service';

@Module({
  imports: [StockMovementsModule],
  controllers: [DailyRecordsController],
  providers: [DailyRecordsService],
})
export class DailyRecordsModule {}
