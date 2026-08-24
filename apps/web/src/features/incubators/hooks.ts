import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateIncubatorInput, Incubator, UpdateIncubatorInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useIncubators() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['incubators'],
    queryFn: () => apiFetch<Incubator[]>('/incubators'),
  });
}

export function useIncubator(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['incubators', id],
    queryFn: () => apiFetch<Incubator>(`/incubators/${id}`),
    enabled: !!id,
  });
}

export function useCreateIncubator() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIncubatorInput) =>
      apiFetch<Incubator>('/incubators', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incubators'] }),
  });
}

export function useUpdateIncubator(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateIncubatorInput) =>
      apiFetch<Incubator>(`/incubators/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incubators'] }),
  });
}

export function useDeleteIncubator() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/incubators/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incubators'] }),
  });
}
