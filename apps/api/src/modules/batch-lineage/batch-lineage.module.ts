import { Module } from '@nestjs/common';
import { BatchLineageController } from './batch-lineage.controller';
import { BatchLineageService } from './batch-lineage.service';

@Module({
  controllers: [BatchLineageController],
  providers: [BatchLineageService],
})
export class BatchLineageModule {}
