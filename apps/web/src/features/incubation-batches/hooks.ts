import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateIncubationBatchInput,
  IncubationBatchProfitability,
  IncubationBatchWithComputed,
  UpdateIncubationBatchInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useIncubationBatches(options?: { enabled?: boolean }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['incubation-batches'],
    queryFn: () => apiFetch<IncubationBatchWithComputed[]>('/incubation-batches'),
    enabled: options?.enabled,
  });
}

export function useIncubationBatch(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['incubation-batches', id],
    queryFn: () => apiFetch<IncubationBatchWithComputed>(`/incubation-batches/${id}`),
    enabled: !!id,
  });
}

/** GET /:id/profitability — CA compte uniquement les orientations VENTE
 * (CHAIR/RENOUVELLEMENT exclus délibérément, voir shared-types). */
export function useIncubationBatchProfitability(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['incubation-batches', id, 'profitability'],
    queryFn: () => apiFetch<IncubationBatchProfitability>(`/incubation-batches/${id}/profitability`),
    enabled: !!id,
  });
}

export function useCreateIncubationBatch() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIncubationBatchInput) =>
      apiFetch<IncubationBatchWithComputed>('/incubation-batches', { method: 'POST', body: input }),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ['incubation-batches'] });
      // eggCount consommé impacte availableFertileEggs du lot reproducteur
      // source, affiché sur sa fiche.
      queryClient.invalidateQueries({ queryKey: ['breeder-batches', batch.breederBatchId] });
    },
  });
}

export function useUpdateIncubationBatch(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateIncubationBatchInput) =>
      apiFetch<IncubationBatchWithComputed>(`/incubation-batches/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incubation-batches'] });
    },
  });
}
