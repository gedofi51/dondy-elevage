import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateItemInput, Item, UpdateItemInput } from '@dondy-elevage/shared-types';
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
