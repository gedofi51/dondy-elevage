import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Alert, AlertStatus, PaginatedResult } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** `typePrefix` (Lot 4) — filtre par préfixe de `type`, pas une égalité
 * stricte : les types d'alerte embarquent souvent un suffixe variable
 * (jour/date, voir batch_high_mortality_j{N} et les anomalies croisées
 * du Lot 4) — extension de l'endpoint existant (GET /alerts), pas un
 * nouveau mécanisme parallèle. `enabled` (Lot Tableau de bord) : les
 * appelants précédents ne montaient le composant que sous
 * `<Can permission={ALERTS_READ}>`, donc le hook n'était jamais appelé
 * sans le droit ; le tableau de bord a besoin de la liste dès le niveau
 * page (référencement croisé avec la courbe de croissance/le tableau des
 * bandes), avant tout `<Can>` — exclu de la queryKey pour ne pas créer
 * une entrée de cache distincte selon sa valeur. */
export function useAlerts(
  params: { status?: AlertStatus; typePrefix?: string; limit?: number; enabled?: boolean } = {},
) {
  const apiFetch = useApiFetch();
  const { enabled, ...filters } = params;
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: () =>
      apiFetch<PaginatedResult<Alert>>('/alerts', {
        searchParams: { status: filters.status, typePrefix: filters.typePrefix, limit: filters.limit },
      }),
    enabled,
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
