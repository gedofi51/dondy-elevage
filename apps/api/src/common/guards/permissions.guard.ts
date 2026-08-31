import {
  Injectable,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  ANY_PERMISSIONS_METADATA_KEY,
  PERMISSIONS_METADATA_KEY,
} from '../decorators/require-permissions.decorator';
import type { PermissionCode } from '../rbac/permissions.constants';
import type { AccessTokenPayload } from '../../modules/auth/jwt-payload.interface';

/**
 * Vérifie les permissions embarquées dans l'access token (résolues à la
 * connexion, voir AuthService/TokenService) — jamais un nom de rôle en dur.
 * Doit toujours être chaîné après JwtAuthGuard (a besoin de req.user).
 * Deux groupes indépendants : `RequirePermissions` (ET, historique) et
 * `RequireAnyPermission` (OU, Lot 7-correctif) — une route sans aucun des
 * deux reste publique une fois authentifiée, comme avant.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAll = this.reflector.getAllAndOverride<PermissionCode[]>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<PermissionCode[]>(
      ANY_PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasAllGroup = !!requiredAll && requiredAll.length > 0;
    const hasAnyGroup = !!requiredAny && requiredAny.length > 0;
    if (!hasAllGroup && !hasAnyGroup) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié.');
    }

    if (hasAllGroup) {
      const hasAll = requiredAll.every((permission) => user.permissions.includes(permission));
      if (!hasAll) {
        throw new ForbiddenException('Permissions insuffisantes pour cette action.');
      }
    }

    if (hasAnyGroup) {
      const hasAny = requiredAny.some((permission) => user.permissions.includes(permission));
      if (!hasAny) {
        throw new ForbiddenException('Permissions insuffisantes pour cette action.');
      }
    }

    return true;
  }
}
