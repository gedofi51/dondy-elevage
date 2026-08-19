import { Module } from '@nestjs/common';
import { BreederBatchesModule } from '../breeder-batches.module';
import { DailyRecordsController } from './daily-records.controller';
import { DailyRecordsService } from './daily-records.service';

@Module({
  imports: [BreederBatchesModule],
  controllers: [DailyRecordsController],
  providers: [DailyRecordsService],
})
export class DailyRecordsModule {}
