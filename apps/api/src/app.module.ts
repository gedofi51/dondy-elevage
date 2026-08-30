import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuditLogModule } from './common/audit/audit-log.module';
import { HealthModule } from './common/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { FarmsModule } from './modules/farms/farms.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { BroilerBatchesModule } from './modules/broiler-batches/broiler-batches.module';
import { DailyRecordsModule as BroilerDailyRecordsModule } from './modules/broiler-batches/daily-records/daily-records.module';
import { MortalityModule } from './modules/broiler-batches/mortality/mortality.module';
import { HealthEventsModule as BroilerHealthEventsModule } from './modules/broiler-batches/health-events/health-events.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SalesModule } from './modules/sales/sales.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LayerBatchesModule } from './modules/layer-batches/layer-batches.module';
import { DailyRecordsModule as LayerDailyRecordsModule } from './modules/layer-batches/daily-records/daily-records.module';
import { HealthEventsModule as LayerHealthEventsModule } from './modules/layer-batches/health-events/health-events.module';
import { EggStockModule } from './modules/egg-stock/egg-stock.module';
import { IncubatorsModule } from './modules/incubators/incubators.module';
import { BreederBatchesModule } from './modules/breeder-batches/breeder-batches.module';
import { DailyRecordsModule as BreederDailyRecordsModule } from './modules/breeder-batches/daily-records/daily-records.module';
import { IncubationBatchesModule } from './modules/incubation-batches/incubation-batches.module';
import { OrientationModule } from './modules/incubation-batches/orientation/orientation.module';
import { ChickBatchesModule } from './modules/chick-batches/chick-batches.module';
import { BatchLineageModule } from './modules/batch-lineage/batch-lineage.module';
import { WaterPointsModule } from './modules/water-points/water-points.module';
import { WaterReadingsModule } from './modules/water-points/readings/water-readings.module';
import { ItemsModule } from './modules/items/items.module';
import { StockMovementsModule } from './modules/stock-movements/stock-movements.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { GoodsReceiptsModule } from './modules/purchase-orders/receipts/goods-receipts.module';
import { SupplierPaymentsModule } from './modules/supplier-payments/supplier-payments.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { AssetsModule } from './modules/assets/assets.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { InfrastructureModule } from './modules/infrastructure/infrastructure.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/employees/attendance/attendance.module';
import { EmployeeTasksModule } from './modules/employees/tasks/employee-tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Premier ordonnanceur du projet — voir BroilerAlertsCronService
    // (alertes calendaires J1-J45, Phase 3), LayerAlertsCronService
    // (alertes pondeuses, Phase 4), BreederAlertsCronService (reproduction
    // + couvoir, Phase 5) et WaterAlertsCronService (eau, Phase 6) —
    // quatre crons séparés, règles structurellement différentes par
    // domaine.
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),
    PrismaModule,
    MailModule,
    AuditLogModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    FarmsModule,
    BuildingsModule,
    SuppliersModule,
    CustomersModule,
    DocumentsModule,
    NotificationsModule,
    AlertsModule,
    BroilerBatchesModule,
    BroilerDailyRecordsModule,
    MortalityModule,
    BroilerHealthEventsModule,
    ExpensesModule,
    SalesModule,
    PaymentsModule,
    LayerBatchesModule,
    LayerDailyRecordsModule,
    LayerHealthEventsModule,
    EggStockModule,
    IncubatorsModule,
    BreederBatchesModule,
    BreederDailyRecordsModule,
    IncubationBatchesModule,
    OrientationModule,
    ChickBatchesModule,
    BatchLineageModule,
    WaterPointsModule,
    WaterReadingsModule,
    ItemsModule,
    StockMovementsModule,
    PurchaseOrdersModule,
    GoodsReceiptsModule,
    SupplierPaymentsModule,
    TreasuryModule,
    AssetsModule,
    MaintenanceModule,
    InfrastructureModule,
    EmployeesModule,
    AttendanceModule,
    EmployeeTasksModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
