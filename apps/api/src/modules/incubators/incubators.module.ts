import { Module } from '@nestjs/common';
import { IncubatorsController } from './incubators.controller';
import { IncubatorsService } from './incubators.service';

@Module({
  controllers: [IncubatorsController],
  providers: [IncubatorsService],
  exports: [IncubatorsService],
})
export class IncubatorsModule {}
