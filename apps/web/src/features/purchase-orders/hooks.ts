import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGoodsReceiptInput,
  CreatePurchaseOrderInput,
  GoodsReceipt,
  PurchaseOrderWithComputed,
  UpdatePurchaseOrderInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function usePurchaseOrders() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => apiFetch<PurchaseOrderWithComputed[]>('/purchase-orders'),
  });
}

export function usePurchaseOrder(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => apiFetch<PurchaseOrderWithComputed>(`/purchase-orders/${id}`),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) =>
      apiFetch<PurchaseOrderWithComputed>('/purchase-orders', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}

/** Même endpoint que la modification générale (PATCH), mais utilisé ici
 * uniquement pour la transition BROUILLON->COMMANDE (voir C.3 du plan —
 * pas de formulaire de modification générale construit cette phase,
 * hors périmètre du kickoff). */
export function useUpdatePurchaseOrder(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePurchaseOrderInput) =>
      apiFetch<PurchaseOrderWithComputed>(`/purchase-orders/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

export function useGoodsReceipts(purchaseOrderId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['purchase-orders', purchaseOrderId, 'receipts'],
    queryFn: () => apiFetch<GoodsReceipt[]>(`/purchase-orders/${purchaseOrderId}/receipts`),
    enabled: !!purchaseOrderId,
  });
}

export function useCreateGoodsReceipt(purchaseOrderId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoodsReceiptInput) =>
      apiFetch<GoodsReceipt>(`/purchase-orders/${purchaseOrderId}/receipts`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', purchaseOrderId, 'receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
