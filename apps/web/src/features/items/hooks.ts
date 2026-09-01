import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateItemInput,
  Item,
  ItemForecast,
  UpdateItemInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

interface UseItemsQuery {
  category?: string;
  belowThreshold?: boolean;
}

/** `category` est un champ texte libre paramétrable côté API (pas un enum
 * figé) — 'aliments' est la convention déjà utilisée ailleurs dans le
 * backend (voir tests broiler-batches) pour le poste alimentation.
 * `belowThreshold=true` est un filtre SERVEUR réel (ORANGE+ROUGE), pas un
 * palliatif client comme les autres listes du projet. */
export function useItems(query?: UseItemsQuery) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['items', query],
    queryFn: () =>
      apiFetch<Item[]>('/items', {
        searchParams: { category: query?.category, belowThreshold: query?.belowThreshold },
      }),
  });
}

/**
 * Prévisions stocks (Lot 2) — GET /items/previsions renvoie uniquement
 * les champs prévisionnels (voir shared-types/items.ts), pas les
 * métadonnées de l'article (nom, catégorie, unité) : le composant
 * consommateur croise ce résultat avec useItems() (déjà en cache React
 * Query, aucun fetch supplémentaire) par `itemId`/`id`, plutôt que de
 * dupliquer ces champs dans la réponse — payload plus léger, un seul
 * endroit où le nom d'un article est réellement stocké.
 */
export function useItemForecasts() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['items', 'previsions'],
    queryFn: () => apiFetch<ItemForecast[]>('/items/previsions'),
  });
}

export interface ItemWithForecast {
  item: Item;
  /** `undefined` seulement pendant le chargement — GET /items/previsions
   * renvoie toujours une entrée par article de la ferme (jamais un
   * sous-ensemble), voir ItemsService.findAllForecast. */
  forecast: ItemForecast | undefined;
}

/** Jointure côté client entre useItems() (réel) et useItemForecasts()
 * (prévisionnel) — voir useItemForecasts() pour la raison de ne pas
 * dupliquer les métadonnées article dans la réponse prévisions. Les deux
 * requêtes partent en parallèle (React Query), pas en cascade. */
export function useItemsWithForecast(): { data: ItemWithForecast[] | undefined; isLoading: boolean } {
  const itemsQuery = useItems();
  const forecastsQuery = useItemForecasts();

  const forecastByItemId = new Map((forecastsQuery.data ?? []).map((f) => [f.itemId, f]));
  const data = itemsQuery.data?.map((item) => ({
    item,
    forecast: forecastByItemId.get(item.id),
  }));

  return { data, isLoading: itemsQuery.isLoading || forecastsQuery.isLoading };
}

export function useItem(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['items', id],
    queryFn: () => apiFetch<Item>(`/items/${id}`),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) => apiFetch<Item>('/items', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useUpdateItem(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateItemInput) =>
      apiFetch<Item>(`/items/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useDeleteItem() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}
