import { PERMISSIONS, ALL_PERMISSIONS, type PermissionCode } from './permissions.constants';

/**
 * Référentiel de rôles validé (Phase 1, étape 0) — voir
 * docs/architecture/DONDY_ELEVAGE_GO_PHASE0.md pour la fusion argumentée des
 * listes V5 §11 et fichiers projet. Coexistence Employé / Responsable
 * élevage sans fusion, actée telle quelle.
 *
 * `isSystem: true` + `farmId: null` : gabarit disponible pour toute ferme,
 * pas un rôle recréé individuellement par ferme (voir schema.prisma,
 * commentaire sur Role.farmId).
 */
export interface RoleCatalogEntry {
  name: string;
  isSystem: true;
  /** true = rôle plateforme (hors périmètre d'une ferme précise) */
  isPlatformRole: boolean;
  permissions: PermissionCode[];
}

export const ROLES_CATALOG: RoleCatalogEntry[] = [
  {
    name: 'Super Admin',
    isSystem: true,
    isPlatformRole: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Propriétaire / Administrateur',
    isSystem: true,
    isPlatformRole: false,
    permissions: [
      PERMISSIONS.FARMS_READ,
      PERMISSIONS.FARMS_UPDATE,
      PERMISSIONS.BUILDINGS_CREATE,
      PERMISSIONS.BUILDINGS_READ,
      PERMISSIONS.BUILDINGS_UPDATE,
      PERMISSIONS.BUILDINGS_DELETE,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_ASSIGN,
    ],
  },
  {
    name: 'Gérant / Responsable ferme',
    isSystem: true,
    isPlatformRole: false,
    permissions: [
      PERMISSIONS.FARMS_READ,
      PERMISSIONS.BUILDINGS_READ,
      PERMISSIONS.BUILDINGS_UPDATE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.ROLES_READ,
    ],
  },
  {
    name: 'Responsable élevage',
    isSystem: true,
    isPlatformRole: false,
    permissions: [PERMISSIONS.FARMS_READ, PERMISSIONS.BUILDINGS_READ],
  },
  {
    name: 'Responsable couvoir',
    isSystem: true,
    isPlatformRole: false,
    permissions: [PERMISSIONS.FARMS_READ, PERMISSIONS.BUILDINGS_READ],
  },
  {
    name: 'Responsable eau',
    isSystem: true,
    isPlatformRole: false,
    permissions: [PERMISSIONS.FARMS_READ, PERMISSIONS.BUILDINGS_READ],
  },
  {
    name: 'Magasinier / Responsable stocks',
    isSystem: true,
    isPlatformRole: false,
    permissions: [PERMISSIONS.FARMS_READ, PERMISSIONS.BUILDINGS_READ],
  },
  {
    name: 'Vendeur / Caisse',
    isSystem: true,
    isPlatformRole: false,
    permissions: [PERMISSIONS.FARMS_READ],
  },
  {
    name: 'Comptable / Responsable financier',
    isSystem: true,
    isPlatformRole: false,
    permissions: [PERMISSIONS.FARMS_READ, PERMISSIONS.BUILDINGS_READ],
  },
  {
    name: 'Employé',
    isSystem: true,
    isPlatformRole: false,
    permissions: [PERMISSIONS.FARMS_READ],
  },
  {
    name: 'Lecteur / Lecture seule',
    isSystem: true,
    isPlatformRole: false,
    permissions: [
      PERMISSIONS.FARMS_READ,
      PERMISSIONS.BUILDINGS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.ROLES_READ,
    ],
  },
];
