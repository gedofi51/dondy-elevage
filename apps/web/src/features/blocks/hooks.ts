import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Block, CreateBlockInput, UpdateBlockInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** Pas de filtre `buildingId` en requête — même précédent que
 * useMaintenanceTasks() (GET /maintenance-tasks) : ramène tous les blocs de
 * la ferme, filtrage côté client par bâtiment (voir BuildingDetailView et
 * BlockSelect). */
export function useBlocks() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['blocks'],
    queryFn: () => apiFetch<Block[]>('/blocks'),
  });
}

export function useCreateBlock() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlockInput) => apiFetch<Block>('/blocks', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  });
}

export function useUpdateBlock(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBlockInput) =>
      apiFetch<Block>(`/blocks/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  });
}

export function useDeleteBlock() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/blocks/${id}`, { method: 'DELETE' }),
    // Un bloc supprimé peut effacer (SetNull) le blockId de bandes déjà
    // chargées en cache (broiler/layer/breeder-batches) — invalidation
    // large plutôt que de traquer précisément quelles bandes l'utilisaient.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['broiler-batches'] });
      queryClient.invalidateQueries({ queryKey: ['layer-batches'] });
      queryClient.invalidateQueries({ queryKey: ['breeder-batches'] });
    },
  });
}
