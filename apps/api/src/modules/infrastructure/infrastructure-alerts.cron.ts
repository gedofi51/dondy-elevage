import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Asset } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

const MS_PER_DAY = 86_400_000;
const DEFAULT_WATER_RESERVOIR_LOW_PERCENT = 20;
const DEFAULT_SOLAR_BATTERY_LOW_PERCENT = 20;
const DEFAULT_READING_STALENESS_DAYS = 7;

/**
 * Cahier V6 §4/§5/§6 — "alarmes onduleurs/régulateurs", "pertes/écarts",
 * "état opérationnel/hors ligne", aucun seuil chiffré donné. Même patron
 * exact que AssetsAlertsCronService/MaintenanceAlertsCronService :
 * balayage quotidien 6h Africa/Bangui, try/catch par actif, idempotence
 * par alerte d'état, seuils paramétrables via Setting.
 *
 * 6 règles (2 par domaine) :
 * - Valeur basse/hors ligne (réservoir eau, batterie solaire, réseau
 *   hors ligne) : sévérité IMPORTANT — franchit délibérément
 *   NOTIFIED_SEVERITIES, infrastructures qualifiées "critiques" par le
 *   cahier (cohérent avec le choix déjà fait en Phase 17 pour la
 *   maintenance en retard).
 * - Absence de relevé récent (précédent direct :
 *   WaterAlertsCronService.checkMissingEntry(), module commercial eau) :
 *   sévérité VIGILANCE, seuil plus souple que checkMissingEntry (ces
 *   relevés sont "si mesurable"/"si disponible", pas un rituel commercial
 *   quotidien obligatoire) — vérifié seulement sur les Asset ayant déjà
 *   au moins un relevé, dédoublonnage persistant (pas par jour).
 *
 * Voir DETTE_TECHNIQUE.md Phase 18, décision C.5.
 */
@Injectable()
export class InfrastructureAlertsCronService {
  private readonly logger = new Logger(InfrastructureAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: 'Africa/Bangui', unrefTimeout: true })
  async runDailySweep(): Promise<void> {
    const assets = await this.prisma.asset.findMany({ where: { status: { not: 'REFORME' } } });
    for (const asset of assets) {
      try {
        await this.processAsset(asset);
      } catch (error) {
        this.logger.error(
          `Échec du balayage d'alertes infrastructure pour l'actif ${asset.id}`,
          error,
        );
      }
    }
  }

  private async alertAlreadyRaised(
    farmId: string,
    type: string,
    entityId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.alert.findFirst({
      where: { farmId, type, entityId },
      select: { id: true },
    });
    return existing !== null;
  }

  private async getSettingNumber(farmId: string, key: string, fallback: number): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { farmId_key: { farmId, key } },
    });
    return typeof setting?.value === 'number' ? setting.value : fallback;
  }

  private async processAsset(asset: Asset): Promise<void> {
    await this.checkWaterReservoirLow(asset);
    await this.checkReadingMissing(
      asset,
      this.prisma.waterInfrastructureReading,
      'water_infrastructure_reading_missing',
      'infrastructure.water_reading_staleness_days',
    );
    await this.checkSolarBatteryLow(asset);
    await this.checkReadingMissing(
      asset,
      this.prisma.solarInfrastructureReading,
      'solar_infrastructure_reading_missing',
      'infrastructure.solar_reading_staleness_days',
    );
    await this.checkNetworkOffline(asset);
    await this.checkReadingMissing(
      asset,
      this.prisma.networkStatusReading,
      'network_status_reading_missing',
      'infrastructure.network_reading_staleness_days',
    );
  }

  private async checkWaterReservoirLow(asset: Asset): Promise<void> {
    const lastReading = await this.prisma.waterInfrastructureReading.findFirst({
      where: { assetId: asset.id },
      orderBy: { date: 'desc' },
    });
    if (!lastReading || lastReading.reservoirLevelPercent === null) {
      return;
    }
    const threshold = await this.getSettingNumber(
      asset.farmId,
      'infrastructure.water_reservoir_low_percent',
      DEFAULT_WATER_RESERVOIR_LOW_PERCENT,
    );
    if (Number(lastReading.reservoirLevelPercent) > threshold) {
      return;
    }

    const type = 'water_reservoir_low';
    if (await this.alertAlreadyRaised(asset.farmId, type, asset.id)) {
      return;
    }
    await this.alertsService.createSystemAlert(asset.farmId, {
      type,
      severity: 'IMPORTANT',
      title: `${asset.code} — Niveau de réservoir bas`,
      entityType: 'asset',
      entityId: asset.id,
    });
  }

  private async checkSolarBatteryLow(asset: Asset): Promise<void> {
    const lastReading = await this.prisma.solarInfrastructureReading.findFirst({
      where: { assetId: asset.id },
      orderBy: { date: 'desc' },
    });
    if (!lastReading || lastReading.batteryChargePercent === null) {
      return;
    }
    const threshold = await this.getSettingNumber(
      asset.farmId,
      'infrastructure.solar_battery_low_percent',
      DEFAULT_SOLAR_BATTERY_LOW_PERCENT,
    );
    if (Number(lastReading.batteryChargePercent) > threshold) {
      return;
    }

    const type = 'solar_battery_low';
    if (await this.alertAlreadyRaised(asset.farmId, type, asset.id)) {
      return;
    }
    await this.alertsService.createSystemAlert(asset.farmId, {
      type,
      severity: 'IMPORTANT',
      title: `${asset.code} — Charge batterie basse`,
      entityType: 'asset',
      entityId: asset.id,
    });
  }

  private async checkNetworkOffline(asset: Asset): Promise<void> {
    const lastReading = await this.prisma.networkStatusReading.findFirst({
      where: { assetId: asset.id },
      orderBy: { date: 'desc' },
    });
    if (!lastReading || lastReading.operationalStatus !== 'HORS_LIGNE') {
      return;
    }

    const type = 'network_offline';
    if (await this.alertAlreadyRaised(asset.farmId, type, asset.id)) {
      return;
    }
    await this.alertsService.createSystemAlert(asset.farmId, {
      type,
      severity: 'IMPORTANT',
      title: `${asset.code} — Réseau hors ligne`,
      entityType: 'asset',
      entityId: asset.id,
    });
  }

  /** Précédent : WaterAlertsCronService.checkMissingEntry() — ici, seuil
   * souple paramétrable (défaut 7 jours) plutôt que strict "hier", et
   * uniquement pour les Asset ayant déjà au moins un relevé (pas de nag
   * sur une infrastructure jamais encore relevée). */
  private async checkReadingMissing(
    asset: Asset,
    readingDelegate: {
      findFirst: (args: {
        where: { assetId: string };
        orderBy: { date: 'desc' };
      }) => Promise<{ date: Date } | null>;
    },
    type: string,
    settingKey: string,
  ): Promise<void> {
    const lastReading = await readingDelegate.findFirst({
      where: { assetId: asset.id },
      orderBy: { date: 'desc' },
    });
    if (!lastReading) {
      return;
    }
    const staleDays = await this.getSettingNumber(
      asset.farmId,
      settingKey,
      DEFAULT_READING_STALENESS_DAYS,
    );
    const daysSinceLastReading = Math.floor((Date.now() - lastReading.date.getTime()) / MS_PER_DAY);
    if (daysSinceLastReading < staleDays) {
      return;
    }

    if (await this.alertAlreadyRaised(asset.farmId, type, asset.id)) {
      return;
    }
    await this.alertsService.createSystemAlert(asset.farmId, {
      type,
      severity: 'VIGILANCE',
      title: `${asset.code} — Aucun relevé depuis ${daysSinceLastReading} jours`,
      entityType: 'asset',
      entityId: asset.id,
    });
  }
}
