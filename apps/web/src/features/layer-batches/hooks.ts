import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchPerformanceScore,
  CreateLayerBatchInput,
  CreateLayerDailyRecordInput,
  CreateLayerHealthEventInput,
  LayerBatchClosureSummary,
  LayerBatchWithComputed,
  LayerDailyRecord,
  LayerForecast,
  LayerHealthEvent,
  LayerPerformanceCoefficients,
  UpdateLayerBatchInput,
  UpdateLayerDailyRecordInput,
} from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useLayerBatches(options?: { enabled?: boolean }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches'],
    queryFn: () => apiFetch<LayerBatchWithComputed[]>('/layer-batches'),
    enabled: options?.enabled,
  });
}

export function useLayerBatch(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', id],
    queryFn: () => apiFetch<LayerBatchWithComputed>(`/layer-batches/${id}`),
    enabled: !!id,
  });
}

/** Même forme que le résumé renvoyé par POST /:id/cloturer — disponible à
 * tout moment sur un lot actif (utilisé pour la section "Rentabilité" de
 * la fiche ET la prévisualisation avant clôture). */
export function useLayerBatchProfitability(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', id, 'profitability'],
    queryFn: () => apiFetch<LayerBatchClosureSummary>(`/layer-batches/${id}/profitability`),
    enabled: !!id,
  });
}

/** Score de performance (Lot 5) — voir
 * broiler-batches/hooks.ts::useBatchPerformanceScore. */
export function useLayerBatchPerformanceScore(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', id, 'performance-score'],
    queryFn: () => apiFetch<BatchPerformanceScore>(`/layer-batches/${id}/performance-score`),
    enabled: !!id,
  });
}

export function useLayerPerformanceCoefficients() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', 'performance-coefficients'],
    queryFn: () =>
      apiFetch<LayerPerformanceCoefficients>('/layer-batches/performance-coefficients'),
  });
}

export function useUpdateLayerPerformanceCoefficients() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LayerPerformanceCoefficients) =>
      apiFetch<LayerPerformanceCoefficients>('/layer-batches/performance-coefficients', {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['layer-batches', 'performance-coefficients'], data);
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'layer-batches' && q.queryKey.includes('performance-score'),
      });
    },
  });
}

/** Prévisions production (Lot 3) — uniquement les lots ELEVAGE/PONTE
 * (voir PROJECTABLE_LAYER_STATUSES côté service). */
export function useLayerBatchForecasts() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', 'previsions'],
    queryFn: () => apiFetch<LayerForecast[]>('/layer-batches/previsions'),
  });
}

export interface LayerBatchWithForecast {
  batch: LayerBatchWithComputed;
  forecast: LayerForecast;
}

/** Jointure côté client — même patron que useBroilerBatchesWithForecast :
 * on itère sur les prévisions (déjà filtrées aux lots ELEVAGE/PONTE côté
 * service), pas sur tous les lots. */
export function useLayerBatchesWithForecast(): {
  data: LayerBatchWithForecast[] | undefined;
  isLoading: boolean;
} {
  const batchesQuery = useLayerBatches();
  const forecastsQuery = useLayerBatchForecasts();

  const batchById = new Map((batchesQuery.data ?? []).map((b) => [b.id, b]));
  const data = forecastsQuery.data
    ?.map((forecast) => {
      const batch = batchById.get(forecast.batchId);
      return batch ? { batch, forecast } : null;
    })
    .filter((row): row is LayerBatchWithForecast => row !== null);

  return { data, isLoading: batchesQuery.isLoading || forecastsQuery.isLoading };
}

export function useCreateLayerBatch() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLayerBatchInput) =>
      apiFetch<LayerBatchWithComputed>('/layer-batches', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['layer-batches'] }),
  });
}

export function useUpdateLayerBatch(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLayerBatchInput) =>
      apiFetch<LayerBatchWithComputed>(`/layer-batches/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layer-batches'] });
    },
  });
}

export function useCloseLayerBatch(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ batch: LayerBatchWithComputed; summary: LayerBatchClosureSummary }>(
        `/layer-batches/${id}/cloturer`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layer-batches'] });
    },
  });
}

export function useLayerDailyRecords(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', batchId, 'daily-records'],
    queryFn: () => apiFetch<LayerDailyRecord[]>(`/layer-batches/${batchId}/daily-records`),
    enabled: !!batchId,
  });
}

/** Contrairement à BroilerDailyRecord (45 lignes pré-générées), une
 * journée de ponte peut ne pas encore exister pour la date demandée — un
 * 404 est un état NORMAL (pas encore saisi aujourd'hui), pas une erreur
 * transitoire à réessayer : `retry: false` pour ne pas retarder
 * l'affichage du formulaire de création. L'appelant doit distinguer
 * `error instanceof ApiError && error.status === 404` (→ création) d'une
 * autre erreur (→ état d'erreur, ne jamais afficher un formulaire vide
 * comme si de rien n'était). */
export function useLayerDailyRecord(batchId: string, date: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', batchId, 'daily-records', date],
    queryFn: () => apiFetch<LayerDailyRecord>(`/layer-batches/${batchId}/daily-records/${date}`),
    enabled: !!batchId && !!date,
    retry: false,
  });
}

function invalidateDailyRecordQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  batchId: string,
  date: string,
) {
  queryClient.invalidateQueries({ queryKey: ['layer-batches', batchId, 'daily-records'] });
  queryClient.invalidateQueries({ queryKey: ['layer-batches', batchId, 'daily-records', date] });
  queryClient.invalidateQueries({ queryKey: ['layer-batches', batchId] });
  queryClient.invalidateQueries({ queryKey: ['egg-stock', 'lots', batchId] });
}

export function useCreateLayerDailyRecord(batchId: string, date: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLayerDailyRecordInput) =>
      apiFetch<LayerDailyRecord>(`/layer-batches/${batchId}/daily-records`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => invalidateDailyRecordQueries(queryClient, batchId, date),
  });
}

export function useUpdateLayerDailyRecord(batchId: string, date: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLayerDailyRecordInput) =>
      apiFetch<LayerDailyRecord>(`/layer-batches/${batchId}/daily-records/${date}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => invalidateDailyRecordQueries(queryClient, batchId, date),
  });
}

export function useLayerHealthEvents(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['layer-batches', batchId, 'health-events'],
    queryFn: () => apiFetch<LayerHealthEvent[]>(`/layer-batches/${batchId}/health-events`),
    enabled: !!batchId,
  });
}

export function useCreateLayerHealthEvent(batchId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLayerHealthEventInput) =>
      apiFetch<LayerHealthEvent>(`/layer-batches/${batchId}/health-events`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layer-batches', batchId, 'health-events'] });
    },
  });
}

const ACTIVE_LAYER_BATCH_STATUSES = new Set(['ELEVAGE', 'PONTE']);

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Agrégat "production d'œufs du jour" toutes bandes confondues — aucun
 * champ agrégé ni endpoint farm-wide côté API (même arbitrage réseau que
 * useTodayMortalityTotal côté Broiler, voir DETTE_TECHNIQUE.md). Différence
 * importante avec Broiler : il n'y a pas de cycle borné à filtrer en amont
 * — un 404 "pas encore saisi aujourd'hui" est le cas NORMAL et quotidien
 * pour chaque lot actif tant que personne n'a saisi, pas une exception
 * rare. `retry: false` sur chaque requête, un 404 compte pour 0 (normal),
 * une autre erreur (403/500) fait retourner `undefined` plutôt que de la
 * masquer silencieusement derrière un total potentiellement faux.
 * `enabled` doit être câblé sur LAYER_DAILY_RECORDS_READ par l'appelant. */
export function useTodayEggProductionTotal(
  batches: LayerBatchWithComputed[] | undefined,
  enabled: boolean,
) {
  const apiFetch = useApiFetch();
  const today = todayIsoDate();
  const activeBatches = enabled
    ? (batches ?? []).filter((b) => ACTIVE_LAYER_BATCH_STATUSES.has(b.status))
    : [];

  const results = useQueries({
    queries: activeBatches.map((batch) => ({
      queryKey: ['layer-batches', batch.id, 'daily-records', today],
      queryFn: () =>
        apiFetch<LayerDailyRecord>(`/layer-batches/${batch.id}/daily-records/${today}`),
      retry: false,
    })),
  });

  if (!enabled || batches === undefined || results.some((r) => r.isLoading)) return undefined;

  let sawRealError = false;
  const total = results.reduce((sum, r) => {
    if (r.error) {
      if (r.error instanceof ApiError && r.error.status === 404) return sum;
      sawRealError = true;
      return sum;
    }
    return sum + (r.data?.eggsLaid ?? 0);
  }, 0);

  return sawRealError ? undefined : total;
}
