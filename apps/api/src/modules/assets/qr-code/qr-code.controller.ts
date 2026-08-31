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
import { AssetQrCodeService } from './qr-code.service';

@Controller('assets/:assetId/qr-code')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetQrCodeController {
  constructor(private readonly qrCodeService: AssetQrCodeService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  async getStatus(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
  ): Promise<QrCodeStatusResult | null> {
    return this.qrCodeService.getStatus(user, assetId);
  }

  @Get('scans')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  async listRecentScans(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
  ): Promise<QrCodeScanEntry[]> {
    return this.qrCodeService.listRecentScans(user, assetId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  async generate(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Req() req: Request,
  ): Promise<QrCodeGeneratedResult> {
    return this.qrCodeService.generate(user, assetId, req.ip ?? null);
  }

  @Post('regenerer')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  async regenerate(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Req() req: Request,
  ): Promise<QrCodeGeneratedResult> {
    return this.qrCodeService.regenerate(user, assetId, req.ip ?? null);
  }

  @Post('revoquer')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  async revoke(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assetId') assetId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.qrCodeService.revoke(user, assetId, req.ip ?? null);
  }
}
