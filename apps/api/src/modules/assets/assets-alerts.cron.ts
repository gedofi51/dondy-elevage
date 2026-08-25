import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Asset } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

const MS_PER_DAY = 86_400_000;
const DEFAULT_WARRANTY_WARNING_DAYS = 30;

/**
 * Phase 16 — cahier V6 §13 : "Actifs totalement amortis" et "Garanties
 * arrivant à expiration" (KPI patrimoniaux, aucune sévérité/délai de
 * préavis chiffré donné par le cahier). Même patron exact que
 * ItemsAlertsCronService (Phase 8) : balayage quotidien, try/catch par
 * actif, idempotence par alerte d'état (une seule fois tant qu'elle n'a
 * pas été acquittée/résolue).
 */
@Injectable()
export class AssetsAlertsCronService {
  private readonly logger = new Logger(AssetsAlertsCronService.name);

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
        // Un actif en erreur ne doit jamais interrompre le balayage des autres.
        this.logger.error(`Échec du balayage d'alertes pour l'actif ${asset.id}`, error);
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
    await this.checkWarrantyExpiring(asset);
    await this.checkFullyDepreciated(asset);
  }

  /** Délai de préavis assumé comme paramètre d'ingénierie (le cahier ne le
   * chiffre pas) — reconfigurable via Setting, même traitement que les
   * seuils déjà assumés ailleurs (écart de caisse eau, déviation aliment). */
  private async checkWarrantyExpiring(asset: Asset): Promise<void> {
    if (!asset.warrantyExpiresAt) {
      return;
    }
    const warningDays = await this.getSettingNumber(
      asset.farmId,
      'assets.warranty_expiring_days',
      DEFAULT_WARRANTY_WARNING_DAYS,
    );
    const today = new Date();
    const daysUntilExpiry = Math.floor(
      (asset.warrantyExpiresAt.getTime() - today.getTime()) / MS_PER_DAY,
    );
    if (daysUntilExpiry < 0 || daysUntilExpiry > warningDays) {
      return;
    }

    const type = 'asset_warranty_expiring';
    if (await this.alertAlreadyRaised(asset.farmId, type, asset.id)) {
      return;
    }

    await this.alertsService.createSystemAlert(asset.farmId, {
      type,
      severity: 'VIGILANCE',
      title: `${asset.code} — Garantie arrivant à expiration`,
      entityType: 'asset',
      entityId: asset.id,
    });
  }

  private async checkFullyDepreciated(asset: Asset): Promise<void> {
    const entries = await this.prisma.depreciationEntry.findMany({
      where: { assetId: asset.id },
      orderBy: { periodNumber: 'desc' },
      take: 1,
    });
    const lastEntry = entries[0];
    if (!lastEntry || lastEntry.periodEnd.getTime() > Date.now()) {
      return;
    }

    const type = 'asset_fully_depreciated';
    if (await this.alertAlreadyRaised(asset.farmId, type, asset.id)) {
      return;
    }

    await this.alertsService.createSystemAlert(asset.farmId, {
      type,
      severity: 'INFO',
      title: `${asset.code} — Actif totalement amorti`,
      entityType: 'asset',
      entityId: asset.id,
    });
  }
}
