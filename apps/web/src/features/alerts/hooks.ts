import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Alert, AlertStatus, PaginatedResult } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** `typePrefix` (Lot 4) — filtre par préfixe de `type`, pas une égalité
 * stricte : les types d'alerte embarquent souvent un suffixe variable
 * (jour/date, voir batch_high_mortality_j{N} et les anomalies croisées
 * du Lot 4) — extension de l'endpoint existant (GET /alerts), pas un
 * nouveau mécanisme parallèle. */
export function useAlerts(
  params: { status?: AlertStatus; typePrefix?: string; limit?: number } = {},
) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () =>
      apiFetch<PaginatedResult<Alert>>('/alerts', {
        searchParams: { status: params.status, typePrefix: params.typePrefix, limit: params.limit },
      }),
  });
}

export function useAcknowledgeAlert() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Alert>(`/alerts/${id}/acquitter`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
