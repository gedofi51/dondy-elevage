import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../rbac/permissions.constants';

export const PERMISSIONS_METADATA_KEY = 'requiredPermissions';

/**
 * RBAC piloté par données : ce décorateur ne code jamais un nom de rôle en
 * dur, seulement des codes de permission — la correspondance rôle→permission
 * vit uniquement en base (roles/permissions/role_permissions).
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
