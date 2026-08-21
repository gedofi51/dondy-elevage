/**
 * Déplacé vers packages/shared-types/src/permissions.ts (Phase 9) pour
 * être partagé avec apps/web sans duplication — ce fichier n'est plus
 * qu'un ré-export, gardé pour ne pas casser les ~40 imports existants
 * dans apps/api/src (chemins relatifs déjà en place).
 */
export { PERMISSIONS, ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS } from '@dondy-elevage/shared-types';
export type { PermissionCode } from '@dondy-elevage/shared-types';
