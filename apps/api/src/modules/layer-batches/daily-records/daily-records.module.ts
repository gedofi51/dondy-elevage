import { Module } from '@nestjs/common';
import { DailyRecordsController } from './daily-records.controller';
import { DailyRecordsService } from './daily-records.service';

@Module({
  controllers: [DailyRecordsController],
  providers: [DailyRecordsService],
})
export class DailyRecordsModule {}
