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
import { DailyRecordsModule } from './modules/broiler-batches/daily-records/daily-records.module';
import { MortalityModule } from './modules/broiler-batches/mortality/mortality.module';
import { HealthEventsModule } from './modules/broiler-batches/health-events/health-events.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SalesModule } from './modules/sales/sales.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Premier ordonnanceur du projet — voir BroilerAlertsCronService
    // (alertes calendaires J1-J45, Phase 3).
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
    DailyRecordsModule,
    MortalityModule,
    HealthEventsModule,
    ExpensesModule,
    SalesModule,
    PaymentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
