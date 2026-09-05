import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useUsers() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<PublicUser[]>('/users'),
  });
}

export function useUser(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => apiFetch<PublicUser>(`/users/${id}`),
    enabled: !!id,
  });
}

/** Écran Utilisateurs (Administration) — la création vaut invitation par
 * email, aucun mot de passe dans le payload (voir CreateUserInput,
 * shared-types). */
export function useCreateUser() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiFetch<PublicUser>('/users', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) =>
      apiFetch<PublicUser>(`/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', id] });
    },
  });
}
