import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Asset,
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

function mostRecent<T extends { date: string }>(readings: T[] | undefined): T | undefined {
  if (!readings || readings.length === 0) return undefined;
  return readings.reduce((latest, r) => (r.date > latest.date ? r : latest));
}

export interface InfrastructureLine<TReading> {
  asset: Asset;
  latestReading: TReading | undefined;
}

export interface InfrastructureStatusSummary {
  /** `undefined` = aucun actif de cette catégorie (ACTIF) trouvé sur la
   * ferme — jamais une ligne vide/inventée, voir dashboard-infrastructure-panel. */
  water: InfrastructureLine<WaterInfrastructureReadingWithComputed> | undefined;
  solar: InfrastructureLine<SolarInfrastructureReading> | undefined;
  network: InfrastructureLine<NetworkStatusReading> | undefined;
  isLoading: boolean;
}

/**
 * Synthèse Infrastructures (Lot Tableau de bord) — reprend les données de
 * Phase 18/19 : un asset par catégorie ('eau'/'solaire'/'internet', même
 * convention que asset-detail-view.tsx), dernier relevé (date la plus
 * récente, tri client — les endpoints de relevés ne garantissent pas
 * d'ordre). N'appelle QUE les hooks déjà existants
 * (use*InfrastructureReadings), aucun fetch dupliqué — un asset non
 * trouvé (assetId undefined) laisse le hook sous-jacent inactif
 * (`enabled: !!assetId`).
 *
 * S'il existe plusieurs actifs ACTIFS de la même catégorie sur une ferme,
 * seul le premier trouvé est retenu (limite assumée, cas non couvert par
 * le mockup qui n'en montre qu'un par catégorie).
 */
export function useInfrastructureStatusSummary(
  assets: Asset[] | undefined,
): InfrastructureStatusSummary {
  const waterAsset = assets?.find((a) => a.category === 'eau' && a.status === 'ACTIF');
  const solarAsset = assets?.find((a) => a.category === 'solaire' && a.status === 'ACTIF');
  const networkAsset = assets?.find((a) => a.category === 'internet' && a.status === 'ACTIF');

  const waterReadings = useWaterInfrastructureReadings(waterAsset?.id ?? '');
  const solarReadings = useSolarInfrastructureReadings(solarAsset?.id ?? '');
  const networkReadings = useNetworkStatusReadings(networkAsset?.id ?? '');

  return {
    water: waterAsset ? { asset: waterAsset, latestReading: mostRecent(waterReadings.data) } : undefined,
    solar: solarAsset ? { asset: solarAsset, latestReading: mostRecent(solarReadings.data) } : undefined,
    network: networkAsset
      ? { asset: networkAsset, latestReading: mostRecent(networkReadings.data) }
      : undefined,
    isLoading:
      assets === undefined ||
      (!!waterAsset && waterReadings.isLoading) ||
      (!!solarAsset && solarReadings.isLoading) ||
      (!!networkAsset && networkReadings.isLoading),
  };
}
