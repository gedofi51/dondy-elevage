/**
 * Catalogue des permissions — RBAC piloté par données (voir schema.prisma,
 * modèles Role/Permission/RolePermission). Cette liste n'est PAS un enum
 * métier figé : elle décrit seulement les codes que le code applicatif
 * connaît et vérifie via PermissionsGuard. Étendue phase après phase, en
 * même temps que les modules métier correspondants.
 *
 * `platform.manage` est un cas particulier : réservé au rôle système
 * Super Admin, il autorise les opérations transverses à toutes les fermes
 * (ex. création d'une nouvelle ferme) — jamais accordé à un rôle de ferme.
 */
export const PERMISSIONS = {
  PLATFORM_MANAGE: 'platform.manage',

  FARMS_READ: 'farms.read',
  FARMS_UPDATE: 'farms.update',

  BUILDINGS_CREATE: 'buildings.create',
  BUILDINGS_READ: 'buildings.read',
  BUILDINGS_UPDATE: 'buildings.update',
  BUILDINGS_DELETE: 'buildings.delete',

  USERS_CREATE: 'users.create',
  USERS_READ: 'users.read',
  USERS_UPDATE: 'users.update',

  ROLES_READ: 'roles.read',
  ROLES_ASSIGN: 'roles.assign',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  [PERMISSIONS.PLATFORM_MANAGE]:
    'Opérations transverses à toutes les fermes (réservé au rôle système Super Admin)',
  [PERMISSIONS.FARMS_READ]: 'Consulter les informations de la ferme',
  [PERMISSIONS.FARMS_UPDATE]: 'Modifier les informations/paramètres de la ferme',
  [PERMISSIONS.BUILDINGS_CREATE]: 'Créer un bâtiment',
  [PERMISSIONS.BUILDINGS_READ]: 'Consulter les bâtiments',
  [PERMISSIONS.BUILDINGS_UPDATE]: 'Modifier un bâtiment',
  [PERMISSIONS.BUILDINGS_DELETE]: 'Supprimer un bâtiment',
  [PERMISSIONS.USERS_CREATE]: 'Créer un compte utilisateur (invitation)',
  [PERMISSIONS.USERS_READ]: 'Consulter les utilisateurs de la ferme',
  [PERMISSIONS.USERS_UPDATE]: 'Modifier/désactiver un utilisateur',
  [PERMISSIONS.ROLES_READ]: 'Consulter le référentiel de rôles/permissions',
  [PERMISSIONS.ROLES_ASSIGN]: 'Attribuer/retirer un rôle à un utilisateur',
};
