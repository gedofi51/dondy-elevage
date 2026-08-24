import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BatchLineage, CreateOrientationInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** Filiation "amont" — toutes les orientations issues d'un lot d'incubation
 * (affichées sur sa fiche), et calcul du solde de poussins orientables. */
export function useBatchLineageByIncubation(incubationBatchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['batch-lineage', { incubationBatchId }],
    queryFn: () => apiFetch<BatchLineage[]>('/batch-lineage', { searchParams: { incubationBatchId } }),
    enabled: !!incubationBatchId,
  });
}

/** Filiation "aval" — retrouver l'orientation qui a produit une entité
 * donnée (Card "Origine" sur BroilerBatch/ChickBatch). Un lot n'a jamais
 * plus d'une ligne d'origine (childId référence exactement une naissance),
 * donc [0] est sûr si le tableau n'est pas vide. */
export function useBatchLineageByChild(childType: 'broiler_batch' | 'chick_batch', childId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['batch-lineage', { childType, childId }],
    queryFn: () => apiFetch<BatchLineage[]>('/batch-lineage', { searchParams: { childType, childId } }),
    enabled: !!childId,
  });
}

export function useCreateOrientation(incubationBatchId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrientationInput) =>
      apiFetch<BatchLineage>(`/incubation-batches/${incubationBatchId}/orientation`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['batch-lineage', { incubationBatchId }],
      });
      queryClient.invalidateQueries({ queryKey: ['incubation-batches', incubationBatchId] });
      queryClient.invalidateQueries({ queryKey: ['chick-batches'] });
    },
  });
}
