import { useQuery } from '@tanstack/react-query';
import type { Supplier } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** Certains rôles ayant BROILER_BATCHES_CREATE n'ont pas SUPPLIERS_READ
 * (ex. Responsable élevage) — un 403 est un cas attendu, pas une erreur à
 * remonter. `retry: false` évite de retenter inutilement une requête vouée
 * à échouer par permission ; les appelants doivent lire `isError` pour
 * désactiver gracieusement l'option origine=ACHAT plutôt que planter. */
export function useSuppliers() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiFetch<Supplier[]>('/suppliers'),
    retry: false,
  });
}
