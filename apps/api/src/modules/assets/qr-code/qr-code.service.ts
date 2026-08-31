import { Injectable } from '@nestjs/common';
import { QrEntityType } from '@prisma/client';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import {
  QrCodesService,
  type QrCodeGeneratedResult,
  type QrCodeScanEntry,
  type QrCodeStatusResult,
} from '../../qr-codes/qr-codes.service';
import { AssetsService } from '../assets.service';

/**
 * Fine couche nestée `assets/:assetId/qr-code` — même patron que
 * BroilerBatchQrCodeService (voir ce fichier pour le raisonnement complet).
 */
@Injectable()
export class AssetQrCodeService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly qrCodesService: QrCodesService,
  ) {}

  async generate(
    actingUser: AccessTokenPayload,
    assetId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const asset = await this.assetsService.findOne(actingUser, assetId);
    return this.qrCodesService.generate(
      actingUser,
      QrEntityType.ASSET,
      asset.id,
      asset.farmId,
      ipAddress,
    );
  }

  async regenerate(
    actingUser: AccessTokenPayload,
    assetId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const asset = await this.assetsService.findOne(actingUser, assetId);
    return this.qrCodesService.regenerate(
      actingUser,
      QrEntityType.ASSET,
      asset.id,
      asset.farmId,
      ipAddress,
    );
  }

  async revoke(
    actingUser: AccessTokenPayload,
    assetId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const asset = await this.assetsService.findOne(actingUser, assetId);
    await this.qrCodesService.revoke(actingUser, QrEntityType.ASSET, asset.id, ipAddress);
  }

  async getStatus(
    actingUser: AccessTokenPayload,
    assetId: string,
  ): Promise<QrCodeStatusResult | null> {
    const asset = await this.assetsService.findOne(actingUser, assetId);
    return this.qrCodesService.getStatus(QrEntityType.ASSET, asset.id);
  }

  async listRecentScans(
    actingUser: AccessTokenPayload,
    assetId: string,
  ): Promise<QrCodeScanEntry[]> {
    const asset = await this.assetsService.findOne(actingUser, assetId);
    return this.qrCodesService.listRecentScans(QrEntityType.ASSET, asset.id);
  }
}
