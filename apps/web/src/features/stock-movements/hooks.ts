import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStockMovementInput, StockMovement } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useStockMovements(itemId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['stock-movements', { itemId }],
    queryFn: () => apiFetch<StockMovement[]>('/stock-movements', { searchParams: { itemId } }),
    enabled: !!itemId,
  });
}

export function useCreateStockMovement() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStockMovementInput) =>
      apiFetch<StockMovement>('/stock-movements', { method: 'POST', body: input }),
    onSuccess: (movement) => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements', { itemId: movement.itemId }] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
