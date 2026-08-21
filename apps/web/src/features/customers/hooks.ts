import { useQuery } from '@tanstack/react-query';
import type { Customer } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useCustomers() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => apiFetch<Customer[]>('/customers'),
  });
}
