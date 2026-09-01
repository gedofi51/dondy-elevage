import { Injectable } from '@nestjs/common';
import { QrEntityType } from '@prisma/client';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import {
  QrCodesService,
  type QrCodeGeneratedResult,
  type QrCodeScanEntry,
  type QrCodeStatusResult,
} from '../../qr-codes/qr-codes.service';
import { LayerBatchesService } from '../layer-batches.service';

/**
 * Fine couche nestée `layer-batches/:batchId/qr-code` — même patron que
 * BroilerBatchQrCodeService (voir ce fichier pour le raisonnement complet).
 */
@Injectable()
export class LayerBatchQrCodeService {
  constructor(
    private readonly layerBatchesService: LayerBatchesService,
    private readonly qrCodesService: QrCodesService,
  ) {}

  async generate(
    actingUser: AccessTokenPayload,
    batchId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const batch = await this.layerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.generate(
      actingUser,
      QrEntityType.LAYER_BATCH,
      batch.id,
      batch.farmId,
      ipAddress,
    );
  }

  async regenerate(
    actingUser: AccessTokenPayload,
    batchId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const batch = await this.layerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.regenerate(
      actingUser,
      QrEntityType.LAYER_BATCH,
      batch.id,
      batch.farmId,
      ipAddress,
    );
  }

  async revoke(
    actingUser: AccessTokenPayload,
    batchId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const batch = await this.layerBatchesService.findOne(actingUser, batchId);
    await this.qrCodesService.revoke(actingUser, QrEntityType.LAYER_BATCH, batch.id, ipAddress);
  }

  async getStatus(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<QrCodeStatusResult | null> {
    const batch = await this.layerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.getStatus(QrEntityType.LAYER_BATCH, batch.id);
  }

  async listRecentScans(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<QrCodeScanEntry[]> {
    const batch = await this.layerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.listRecentScans(QrEntityType.LAYER_BATCH, batch.id);
  }
}
