import { Injectable } from '@nestjs/common';
import { QrEntityType } from '@prisma/client';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import {
  QrCodesService,
  type QrCodeGeneratedResult,
  type QrCodeScanEntry,
  type QrCodeStatusResult,
} from '../../qr-codes/qr-codes.service';
import { BroilerBatchesService } from '../broiler-batches.service';

/**
 * Fine couche nestée `broiler-batches/:batchId/qr-code` — vérifie
 * l'existence et l'appartenance-ferme de LA bande via
 * `BroilerBatchesService.findOne()` (jamais dupliqué ici, même patron que
 * AttendanceService/EmployeesService), puis délègue au moteur générique
 * QrCodesService avec `QrEntityType.BROILER_BATCH` fixé.
 */
@Injectable()
export class BroilerBatchQrCodeService {
  constructor(
    private readonly broilerBatchesService: BroilerBatchesService,
    private readonly qrCodesService: QrCodesService,
  ) {}

  async generate(
    actingUser: AccessTokenPayload,
    batchId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const batch = await this.broilerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.generate(
      actingUser,
      QrEntityType.BROILER_BATCH,
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
    const batch = await this.broilerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.regenerate(
      actingUser,
      QrEntityType.BROILER_BATCH,
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
    const batch = await this.broilerBatchesService.findOne(actingUser, batchId);
    await this.qrCodesService.revoke(actingUser, QrEntityType.BROILER_BATCH, batch.id, ipAddress);
  }

  async getStatus(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<QrCodeStatusResult | null> {
    const batch = await this.broilerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.getStatus(QrEntityType.BROILER_BATCH, batch.id);
  }

  async listRecentScans(
    actingUser: AccessTokenPayload,
    batchId: string,
  ): Promise<QrCodeScanEntry[]> {
    const batch = await this.broilerBatchesService.findOne(actingUser, batchId);
    return this.qrCodesService.listRecentScans(QrEntityType.BROILER_BATCH, batch.id);
  }
}
