import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSupplierPaymentInput, SupplierPayment } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useSupplierPayments(purchaseOrderId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['supplier-payments', { purchaseOrderId }],
    queryFn: () =>
      apiFetch<SupplierPayment[]>('/supplier-payments', { searchParams: { purchaseOrderId } }),
    enabled: !!purchaseOrderId,
  });
}

function invalidateForOrder(queryClient: ReturnType<typeof useQueryClient>, purchaseOrderId: string) {
  queryClient.invalidateQueries({ queryKey: ['supplier-payments', { purchaseOrderId }] });
  queryClient.invalidateQueries({ queryKey: ['purchase-orders', purchaseOrderId] });
  queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
}

export function useCreateSupplierPayment(purchaseOrderId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupplierPaymentInput) =>
      apiFetch<SupplierPayment>('/supplier-payments', { method: 'POST', body: input }),
    onSuccess: () => invalidateForOrder(queryClient, purchaseOrderId),
  });
}

export function useDeleteSupplierPayment(purchaseOrderId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/supplier-payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateForOrder(queryClient, purchaseOrderId),
  });
}
