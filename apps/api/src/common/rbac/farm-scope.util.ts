import { NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '../../modules/auth/jwt-payload.interface';
import { PERMISSIONS } from './permissions.constants';

/**
 * Isolation multi-tenant stricte : un utilisateur sans `platform.manage`
 * (Super Admin) ne doit jamais pouvoir accéder à une ressource d'une autre
 * ferme — même avec un ID valide d'un autre tenant. 404 générique (jamais
 * 403) pour ne pas révéler l'existence de la ressource à un tenant tiers.
 */
export function assertSameFarm(user: AccessTokenPayload, targetFarmId: string): void {
  if (user.permissions.includes(PERMISSIONS.PLATFORM_MANAGE)) {
    return;
  }
  if (user.farmId !== targetFarmId) {
    throw new NotFoundException('Ressource introuvable.');
  }
}
