import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateWaterPointInput,
  CreateWaterReadingInput,
  UpdateWaterPointInput,
  WaterPoint,
  WaterPointKpiSummary,
  WaterReading,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useWaterPoints(options?: { enabled?: boolean }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['water-points'],
    queryFn: () => apiFetch<WaterPoint[]>('/water-points'),
    enabled: options?.enabled,
  });
}

export function useWaterPoint(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['water-points', id],
    queryFn: () => apiFetch<WaterPoint>(`/water-points/${id}`),
    enabled: !!id,
  });
}

/** `from`/`to` requis côté API, sans défaut implicite (voir
 * GetWaterPointKpiQueryDto — "période explicite, pas d'ambiguïté") — le
 * choix d'une période par défaut est donc une décision d'affichage,
 * assumée ici (mois en cours). */
export function useWaterPointKpi(id: string, range: { from: string; to: string }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['water-points', id, 'kpi', range],
    queryFn: () =>
      apiFetch<WaterPointKpiSummary>(`/water-points/${id}/kpi`, { searchParams: range }),
    enabled: !!id,
  });
}

export function useWaterReadings(waterPointId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['water-points', waterPointId, 'readings'],
    queryFn: () => apiFetch<WaterReading[]>(`/water-points/${waterPointId}/readings`),
    enabled: !!waterPointId,
  });
}

export function useCreateWaterPoint() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWaterPointInput) =>
      apiFetch<WaterPoint>('/water-points', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['water-points'] }),
  });
}

export function useUpdateWaterPoint(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWaterPointInput) =>
      apiFetch<WaterPoint>(`/water-points/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-points'] });
    },
  });
}

export function useDeleteWaterPoint() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/water-points/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['water-points'] }),
  });
}

export function useCreateWaterReading(waterPointId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWaterReadingInput) =>
      apiFetch<WaterReading>(`/water-points/${waterPointId}/readings`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-points', waterPointId, 'readings'] });
      queryClient.invalidateQueries({ queryKey: ['water-points', waterPointId, 'kpi'] });
    },
  });
}
