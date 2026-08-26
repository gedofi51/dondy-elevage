import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateNetworkStatusReadingInput,
  CreateSolarInfrastructureReadingInput,
  CreateWaterInfrastructureReadingInput,
  NetworkStatusReading,
  SolarInfrastructureReading,
  WaterInfrastructureReadingWithComputed,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useWaterInfrastructureReadings(assetId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['assets', assetId, 'water-infrastructure-readings'],
    queryFn: () =>
      apiFetch<WaterInfrastructureReadingWithComputed[]>(
        `/assets/${assetId}/water-infrastructure-readings`,
      ),
    enabled: !!assetId,
  });
}

export function useCreateWaterInfrastructureReading(assetId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWaterInfrastructureReadingInput) =>
      apiFetch<WaterInfrastructureReadingWithComputed>(
        `/assets/${assetId}/water-infrastructure-readings`,
        { method: 'POST', body: input },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['assets', assetId, 'water-infrastructure-readings'] }),
  });
}

export function useSolarInfrastructureReadings(assetId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['assets', assetId, 'solar-infrastructure-readings'],
    queryFn: () =>
      apiFetch<SolarInfrastructureReading[]>(`/assets/${assetId}/solar-infrastructure-readings`),
    enabled: !!assetId,
  });
}

export function useCreateSolarInfrastructureReading(assetId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSolarInfrastructureReadingInput) =>
      apiFetch<SolarInfrastructureReading>(`/assets/${assetId}/solar-infrastructure-readings`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['assets', assetId, 'solar-infrastructure-readings'] }),
  });
}

export function useNetworkStatusReadings(assetId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['assets', assetId, 'network-status-readings'],
    queryFn: () => apiFetch<NetworkStatusReading[]>(`/assets/${assetId}/network-status-readings`),
    enabled: !!assetId,
  });
}

export function useCreateNetworkStatusReading(assetId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNetworkStatusReadingInput) =>
      apiFetch<NetworkStatusReading>(`/assets/${assetId}/network-status-readings`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['assets', assetId, 'network-status-readings'] }),
  });
}
