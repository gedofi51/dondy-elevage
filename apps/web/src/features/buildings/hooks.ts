import { useQuery } from '@tanstack/react-query';
import type { Building } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useBuildings() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['buildings'],
    queryFn: () => apiFetch<Building[]>('/buildings'),
  });
}
