import { Global, Module } from '@nestjs/common';
import { PerformanceScoreSettingsService } from './performance-score-settings.service';

/** Global, même patron que AuditLogModule/PrismaModule — un seul service
 * sans état, dépendant uniquement de PrismaService (déjà global), consommé
 * à l'identique par les 3 modules Chair/Pondeuses/Couvoir. */
@Global()
@Module({
  providers: [PerformanceScoreSettingsService],
  exports: [PerformanceScoreSettingsService],
})
export class PerformanceScoreSettingsModule {}
