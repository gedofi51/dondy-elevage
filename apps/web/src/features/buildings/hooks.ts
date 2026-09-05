import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Building, CreateBuildingInput, UpdateBuildingInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useBuildings() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['buildings'],
    queryFn: () => apiFetch<Building[]>('/buildings'),
  });
}

export function useBuilding(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['buildings', id],
    queryFn: () => apiFetch<Building>(`/buildings/${id}`),
    enabled: !!id,
  });
}

export function useCreateBuilding() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBuildingInput) =>
      apiFetch<Building>('/buildings', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buildings'] }),
  });
}

export function useUpdateBuilding(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBuildingInput) =>
      apiFetch<Building>(`/buildings/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buildings'] }),
  });
}

export function useDeleteBuilding() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/buildings/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buildings'] }),
  });
}
