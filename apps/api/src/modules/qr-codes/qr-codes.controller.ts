import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { QrCodeResolution } from '@dondy-elevage/shared-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { QrCodesService } from './qr-codes.service';

/**
 * Seul endpoint réellement transversal du module (résolution d'un scan,
 * polymorphe par nature) — la génération/régénération/révocation vit dans
 * chaque module nesté (`broiler-batches/qr-code`, `layer-batches/qr-code`,
 * `assets/qr-code`, `items/qr-code`), voir DETTE_TECHNIQUE.md Lot 1.
 *
 * Pas de `@RequirePermissions` ici : la permission requise dépend du type
 * d'entité résolu à l'exécution (voir QR_ENTITY_READ_PERMISSION côté
 * service) — PermissionsGuard laisse passer (aucun groupe déclaré) et
 * QrCodesService.resolveToken() fait le contrôle lui-même, avec les MÊMES
 * garanties RBAC/farmId qu'un accès direct à la fiche.
 */
@Controller('qr-codes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  @Get('resoudre/:token')
  async resoudre(
    @CurrentUser() user: AccessTokenPayload,
    @Param('token') token: string,
    @Req() req: Request,
  ): Promise<QrCodeResolution> {
    return this.qrCodesService.resolveToken(user, token, req.ip ?? null);
  }
}
