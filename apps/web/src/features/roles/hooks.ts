import { useQuery } from '@tanstack/react-query';
import type { Role } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** Catalogue de rôles système (GET /roles, ROLES_READ) — utilisé pour la
 * sélection de rôle(s) à la création/édition d'un utilisateur. */
export function useRoles() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<Role[]>('/roles'),
  });
}
