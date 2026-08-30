import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEmployeeInput, Employee, UpdateEmployeeInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useEmployees(options?: { enabled?: boolean }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => apiFetch<Employee[]>('/employees'),
    enabled: options?.enabled,
  });
}

export function useEmployee(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => apiFetch<Employee>(`/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiFetch<Employee>('/employees', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) =>
      apiFetch<Employee>(`/employees/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', id] });
    },
  });
}

/** Soft delete côté API (deletedAt) — mais sans endpoint de restauration
 * (voir DETTE_TECHNIQUE.md Lot 2) : une fois confirmée, la fiche
 * disparaît de tous les écrans, comme une suppression définitive du
 * point de vue de l'utilisateur. */
export function useDeleteEmployee() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}
