import { Module } from '@nestjs/common';
import { HealthEventsController } from './health-events.controller';
import { HealthEventsService } from './health-events.service';

@Module({
  controllers: [HealthEventsController],
  providers: [HealthEventsService],
})
export class HealthEventsModule {}
