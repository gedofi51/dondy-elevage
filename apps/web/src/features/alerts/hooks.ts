import { useQuery } from '@tanstack/react-query';
import type { Alert, AlertStatus, PaginatedResult } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useAlerts(params: { status?: AlertStatus; limit?: number } = {}) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () =>
      apiFetch<PaginatedResult<Alert>>('/alerts', {
        searchParams: { status: params.status, limit: params.limit },
      }),
  });
}
