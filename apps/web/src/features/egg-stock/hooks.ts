import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEggStockMovementInput,
  EggStockLotWithRemaining,
  EggStockMovement,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** Pas de route /layer-batches/:id/egg-stock côté API — toujours passer
 * par /egg-stock/lots?batchId=. Triés par productionDate croissant côté
 * serveur (ordre FIFO) : le premier de la liste EST le prochain lot
 * consommé à la vente, pas besoin d'un indicateur dédié. */
export function useEggStockLots(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['egg-stock', 'lots', batchId],
    queryFn: () =>
      apiFetch<EggStockLotWithRemaining[]>('/egg-stock/lots', { searchParams: { batchId } }),
    enabled: !!batchId,
  });
}

export function useEggStockMovements(lotId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['egg-stock', 'movements', lotId],
    queryFn: () =>
      apiFetch<EggStockMovement[]>('/egg-stock/movements', { searchParams: { lotId } }),
    enabled: !!lotId,
  });
}

export function useCreateEggStockMovement(batchId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEggStockMovementInput) =>
      apiFetch<EggStockMovement>('/egg-stock/movements', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egg-stock', 'lots', batchId] });
    },
  });
}
