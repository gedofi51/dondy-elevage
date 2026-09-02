import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AnomalyDetectionCronService } from './anomaly-detection.cron';

/** Détection d'anomalies (Lot 4) — pas de contrôleur : ce module n'expose
 * aucune route propre, seulement un cron qui écrit dans le moteur
 * d'alertes générique (AlertsModule) — consultation via GET /alerts
 * existant (voir extension `typePrefix`, alerts.controller.ts). */
@Module({
  imports: [AlertsModule],
  providers: [AnomalyDetectionCronService],
})
export class AnomalyDetectionModule {}
