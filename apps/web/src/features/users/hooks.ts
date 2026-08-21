import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useUsers() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<PublicUser[]>('/users'),
  });
}
