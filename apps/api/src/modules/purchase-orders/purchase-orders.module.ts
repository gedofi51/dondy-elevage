import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersAlertsCronService } from './purchase-orders-alerts.cron';

@Module({
  imports: [AlertsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PurchaseOrdersAlertsCronService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
