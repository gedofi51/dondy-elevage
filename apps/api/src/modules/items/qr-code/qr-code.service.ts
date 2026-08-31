import { Injectable } from '@nestjs/common';
import { QrEntityType } from '@prisma/client';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import {
  QrCodesService,
  type QrCodeGeneratedResult,
  type QrCodeScanEntry,
  type QrCodeStatusResult,
} from '../../qr-codes/qr-codes.service';
import { ItemsService } from '../items.service';

/**
 * Fine couche nestée `items/:itemId/qr-code` — même patron que
 * BroilerBatchQrCodeService (voir ce fichier pour le raisonnement complet).
 */
@Injectable()
export class ItemQrCodeService {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly qrCodesService: QrCodesService,
  ) {}

  async generate(
    actingUser: AccessTokenPayload,
    itemId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const item = await this.itemsService.findOne(actingUser, itemId);
    return this.qrCodesService.generate(
      actingUser,
      QrEntityType.ITEM,
      item.id,
      item.farmId,
      ipAddress,
    );
  }

  async regenerate(
    actingUser: AccessTokenPayload,
    itemId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const item = await this.itemsService.findOne(actingUser, itemId);
    return this.qrCodesService.regenerate(
      actingUser,
      QrEntityType.ITEM,
      item.id,
      item.farmId,
      ipAddress,
    );
  }

  async revoke(
    actingUser: AccessTokenPayload,
    itemId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const item = await this.itemsService.findOne(actingUser, itemId);
    await this.qrCodesService.revoke(actingUser, QrEntityType.ITEM, item.id, ipAddress);
  }

  async getStatus(
    actingUser: AccessTokenPayload,
    itemId: string,
  ): Promise<QrCodeStatusResult | null> {
    const item = await this.itemsService.findOne(actingUser, itemId);
    return this.qrCodesService.getStatus(QrEntityType.ITEM, item.id);
  }

  async listRecentScans(
    actingUser: AccessTokenPayload,
    itemId: string,
  ): Promise<QrCodeScanEntry[]> {
    const item = await this.itemsService.findOne(actingUser, itemId);
    return this.qrCodesService.listRecentScans(QrEntityType.ITEM, item.id);
  }
}
