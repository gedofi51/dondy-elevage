import { Module } from '@nestjs/common';
import { BreederBatchesModule } from '../breeder-batches/breeder-batches.module';
import { IncubationBatchesController } from './incubation-batches.controller';
import { IncubationBatchesService } from './incubation-batches.service';

@Module({
  imports: [BreederBatchesModule],
  controllers: [IncubationBatchesController],
  providers: [IncubationBatchesService],
  exports: [IncubationBatchesService],
})
export class IncubationBatchesModule {}
