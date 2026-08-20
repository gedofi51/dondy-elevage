import { Module } from '@nestjs/common';
import { StockMovementsModule } from '../../stock-movements/stock-movements.module';
import { HealthEventsController } from './health-events.controller';
import { HealthEventsService } from './health-events.service';

@Module({
  imports: [StockMovementsModule],
  controllers: [HealthEventsController],
  providers: [HealthEventsService],
})
export class HealthEventsModule {}
