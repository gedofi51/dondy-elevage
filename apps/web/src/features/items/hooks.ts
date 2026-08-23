import { useQuery } from '@tanstack/react-query';
import type { Item } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

interface UseItemsQuery {
  category?: string;
}

/** `category` est un champ texte libre paramétrable côté API (pas un enum
 * figé) — 'aliments' est la convention déjà utilisée ailleurs dans le
 * backend (voir tests broiler-batches) pour le poste alimentation. */
export function useItems(query?: UseItemsQuery) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['items', query],
    queryFn: () => apiFetch<Item[]>('/items', { searchParams: { category: query?.category } }),
  });
}
