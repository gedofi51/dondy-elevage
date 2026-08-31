import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import type {
  QrCodeGeneratedResult,
  QrCodeScanEntry,
  QrCodeStatusResult,
} from '../../qr-codes/qr-codes.service';
import { LayerBatchQrCodeService } from './qr-code.service';

@Controller('layer-batches/:batchId/qr-code')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LayerBatchQrCodeController {
  constructor(private readonly qrCodeService: LayerBatchQrCodeService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async getStatus(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
  ): Promise<QrCodeStatusResult | null> {
    return this.qrCodeService.getStatus(user, batchId);
  }

  @Get('scans')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_READ)
  async listRecentScans(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
  ): Promise<QrCodeScanEntry[]> {
    return this.qrCodeService.listRecentScans(user, batchId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_UPDATE)
  async generate(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Req() req: Request,
  ): Promise<QrCodeGeneratedResult> {
    return this.qrCodeService.generate(user, batchId, req.ip ?? null);
  }

  @Post('regenerer')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_UPDATE)
  async regenerate(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Req() req: Request,
  ): Promise<QrCodeGeneratedResult> {
    return this.qrCodeService.regenerate(user, batchId, req.ip ?? null);
  }

  @Post('revoquer')
  @RequirePermissions(PERMISSIONS.LAYER_BATCHES_UPDATE)
  async revoke(
    @CurrentUser() user: AccessTokenPayload,
    @Param('batchId') batchId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.qrCodeService.revoke(user, batchId, req.ip ?? null);
  }
}
