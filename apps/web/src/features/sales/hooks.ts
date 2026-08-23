import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSaleInput, Sale } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useSalesByWaterPoint(waterPointId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['sales', { waterPointId }],
    queryFn: () => apiFetch<Sale[]>('/sales', { searchParams: { waterPointId } }),
    enabled: !!waterPointId,
  });
}

export function useSalesByBatch(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['sales', { batchId }],
    queryFn: () => apiFetch<Sale[]>('/sales', { searchParams: { batchId } }),
    enabled: !!batchId,
  });
}

export function useCreateSale() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSaleInput) => apiFetch<Sale>('/sales', { method: 'POST', body: input }),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      if (sale.waterPointId) {
        queryClient.invalidateQueries({ queryKey: ['water-points', sale.waterPointId, 'kpi'] });
      }
      if (sale.batchId) {
        queryClient.invalidateQueries({ queryKey: ['broiler-batches', sale.batchId] });
        queryClient.invalidateQueries({ queryKey: ['broiler-batches', sale.batchId, 'profitability'] });
      }
    },
  });
}
