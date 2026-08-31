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
import { ItemQrCodeService } from './qr-code.service';

@Controller('items/:itemId/qr-code')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ItemQrCodeController {
  constructor(private readonly qrCodeService: ItemQrCodeService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ITEMS_READ)
  async getStatus(
    @CurrentUser() user: AccessTokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<QrCodeStatusResult | null> {
    return this.qrCodeService.getStatus(user, itemId);
  }

  @Get('scans')
  @RequirePermissions(PERMISSIONS.ITEMS_READ)
  async listRecentScans(
    @CurrentUser() user: AccessTokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<QrCodeScanEntry[]> {
    return this.qrCodeService.listRecentScans(user, itemId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ITEMS_UPDATE)
  async generate(
    @CurrentUser() user: AccessTokenPayload,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ): Promise<QrCodeGeneratedResult> {
    return this.qrCodeService.generate(user, itemId, req.ip ?? null);
  }

  @Post('regenerer')
  @RequirePermissions(PERMISSIONS.ITEMS_UPDATE)
  async regenerate(
    @CurrentUser() user: AccessTokenPayload,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ): Promise<QrCodeGeneratedResult> {
    return this.qrCodeService.regenerate(user, itemId, req.ip ?? null);
  }

  @Post('revoquer')
  @RequirePermissions(PERMISSIONS.ITEMS_UPDATE)
  async revoke(
    @CurrentUser() user: AccessTokenPayload,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.qrCodeService.revoke(user, itemId, req.ip ?? null);
  }
}
