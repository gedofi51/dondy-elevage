import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateExpenseInput, Expense, UpdateExpenseInput } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useExpenses() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['expenses'],
    queryFn: () => apiFetch<Expense[]>('/expenses'),
  });
}

export function useExpense(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: () => apiFetch<Expense>(`/expenses/${id}`),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) =>
      apiFetch<Expense>('/expenses', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUpdateExpense(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateExpenseInput) =>
      apiFetch<Expense>(`/expenses/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useDeleteExpense() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}
