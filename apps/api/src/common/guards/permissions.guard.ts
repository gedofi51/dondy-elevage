import {
  Injectable,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_METADATA_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionCode } from '../rbac/permissions.constants';
import type { AccessTokenPayload } from '../../modules/auth/jwt-payload.interface';

/**
 * Vérifie les permissions embarquées dans l'access token (résolues à la
 * connexion, voir AuthService/TokenService) — jamais un nom de rôle en dur.
 * Doit toujours être chaîné après JwtAuthGuard (a besoin de req.user).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié.');
    }

    const hasAll = required.every((permission) => user.permissions.includes(permission));
    if (!hasAll) {
      throw new ForbiddenException('Permissions insuffisantes pour cette action.');
    }

    return true;
  }
}
