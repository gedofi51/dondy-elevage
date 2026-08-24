import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChickBatchWithComputed, UpdateChickBatchInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useChickBatches() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['chick-batches'],
    queryFn: () => apiFetch<ChickBatchWithComputed[]>('/chick-batches'),
  });
}

export function useChickBatch(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['chick-batches', id],
    queryFn: () => apiFetch<ChickBatchWithComputed>(`/chick-batches/${id}`),
    enabled: !!id,
  });
}

export function useUpdateChickBatch(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateChickBatchInput) =>
      apiFetch<ChickBatchWithComputed>(`/chick-batches/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chick-batches'] });
    },
  });
}
