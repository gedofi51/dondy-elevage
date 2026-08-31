import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../rbac/permissions.constants';

export const PERMISSIONS_METADATA_KEY = 'requiredPermissions';
export const ANY_PERMISSIONS_METADATA_KEY = 'requiredAnyPermissions';

/**
 * RBAC piloté par données : ce décorateur ne code jamais un nom de rôle en
 * dur, seulement des codes de permission — la correspondance rôle→permission
 * vit uniquement en base (roles/permissions/role_permissions).
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);

/**
 * Variante OR de RequirePermissions — accès autorisé si l'utilisateur a AU
 * MOINS UNE des permissions listées (RequirePermissions reste un ET strict,
 * inchangé). Mirroir du `anyPermission` déjà en place côté front
 * (nav-items.ts, Lot 6b) — premier usage : GET /employees/roster (Lot
 * 7-correctif), pour un rôle comme Responsable élevage qui a
 * ATTENDANCE_READ/EMPLOYEE_TASKS_READ mais pas EMPLOYEES_READ. Les deux
 * décorateurs sont cumulables sur une même route (ET-groupe et OU-groupe
 * évalués indépendamment, voir PermissionsGuard) mais aucune route
 * n'utilise cette combinaison à ce jour.
 */
export const RequireAnyPermission = (...permissions: PermissionCode[]) =>
  SetMetadata(ANY_PERMISSIONS_METADATA_KEY, permissions);
