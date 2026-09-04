import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchClosureSummary,
  BatchPerformanceScore,
  BroilerBatchWithComputed,
  BroilerDailyRecord,
  BroilerForecast,
  BroilerHealthEvent,
  BroilerMortality,
  BroilerPerformanceCoefficients,
  CreateBroilerBatchInput,
  CreateHealthEventInput,
  CreateMortalityInput,
  UpdateBroilerBatchInput,
  UpdateDailyRecordInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';
import { computeDayNumber, isDayNumberInCycle } from './day-number';

export function useBroilerBatches(options?: { enabled?: boolean }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches'],
    queryFn: () => apiFetch<BroilerBatchWithComputed[]>('/broiler-batches'),
    enabled: options?.enabled,
  });
}

export function useBroilerBatch(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', id],
    queryFn: () => apiFetch<BroilerBatchWithComputed>(`/broiler-batches/${id}`),
    enabled: !!id,
  });
}

/** Même forme que le résumé renvoyé par POST /:id/cloturer — disponible à
 * tout moment (lecture pure), pas seulement à la clôture (utilisé pour la
 * section "Rentabilité" de la fiche ET la prévisualisation avant clôture). */
export function useBatchProfitability(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', id, 'profitability'],
    queryFn: () => apiFetch<BatchClosureSummary>(`/broiler-batches/${id}/profitability`),
    enabled: !!id,
  });
}

/** Score de performance (Lot 5) — même disponibilité que la rentabilité
 * (bande active ou clôturée), voir useBatchProfitability ci-dessus. */
export function useBatchPerformanceScore(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', id, 'performance-score'],
    queryFn: () => apiFetch<BatchPerformanceScore>(`/broiler-batches/${id}/performance-score`),
    enabled: !!id,
  });
}

/** Coefficients du score (Lot 5) — objet vide tant qu'aucun n'a été
 * configuré (le score applique alors les poids par défaut). */
export function useBroilerPerformanceCoefficients() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', 'performance-coefficients'],
    queryFn: () =>
      apiFetch<BroilerPerformanceCoefficients>('/broiler-batches/performance-coefficients'),
  });
}

/** Écriture réservée à FARMS_UPDATE côté API — le formulaire appelant doit
 * toujours soumettre l'objet complet (mortality+ic+gmq), jamais un
 * correctif partiel : PUT remplace tout le coefficient enregistré (voir
 * PerformanceScoreCoefficients côté shared-types). Invalide aussi tous les
 * scores déjà en cache (nouveaux poids -> nouvelle contribution/score). */
export function useUpdateBroilerPerformanceCoefficients() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BroilerPerformanceCoefficients) =>
      apiFetch<BroilerPerformanceCoefficients>('/broiler-batches/performance-coefficients', {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['broiler-batches', 'performance-coefficients'], data);
      // Un nouveau poids change potentiellement le score de TOUTES les
      // bandes déjà en cache — predicate plutôt qu'une queryKey précise
      // (on ne connaît pas ici la liste des id consultés).
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'broiler-batches' && q.queryKey.includes('performance-score'),
      });
    },
  });
}

/** Prévisions production (Lot 3) — uniquement les bandes en cours de
 * cycle (voir PROJECTABLE_BROILER_STATUSES côté service). */
export function useBroilerBatchForecasts() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', 'previsions'],
    queryFn: () => apiFetch<BroilerForecast[]>('/broiler-batches/previsions'),
  });
}

export interface BroilerBatchWithForecast {
  batch: BroilerBatchWithComputed;
  forecast: BroilerForecast;
}

/** Jointure côté client entre useBroilerBatches() (réel, déjà en cache) et
 * useBroilerBatchForecasts() (prévisionnel) — même patron que
 * useItemsWithForecast (Lot 2). Contrairement à Items (une prévision par
 * article, tous inclus), on itère ici sur les PRÉVISIONS (déjà filtrées
 * aux bandes en cours de cycle côté service) et non sur toutes les
 * bandes — une bande VENDUE/CLOTUREE n'a simplement pas de ligne. */
export function useBroilerBatchesWithForecast(): {
  data: BroilerBatchWithForecast[] | undefined;
  isLoading: boolean;
} {
  const batchesQuery = useBroilerBatches();
  const forecastsQuery = useBroilerBatchForecasts();

  const batchById = new Map((batchesQuery.data ?? []).map((b) => [b.id, b]));
  const data = forecastsQuery.data
    ?.map((forecast) => {
      const batch = batchById.get(forecast.batchId);
      return batch ? { batch, forecast } : null;
    })
    .filter((row): row is BroilerBatchWithForecast => row !== null);

  return { data, isLoading: batchesQuery.isLoading || forecastsQuery.isLoading };
}

export function useCreateBroilerBatch() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBroilerBatchInput) =>
      apiFetch<BroilerBatchWithComputed>('/broiler-batches', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['broiler-batches'] }),
  });
}

export function useUpdateBroilerBatch(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBroilerBatchInput) =>
      apiFetch<BroilerBatchWithComputed>(`/broiler-batches/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broiler-batches'] });
    },
  });
}

export function useCloseBroilerBatch(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ batch: BroilerBatchWithComputed; summary: BatchClosureSummary }>(
        `/broiler-batches/${id}/cloturer`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broiler-batches'] });
    },
  });
}

export function useDailyRecords(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', batchId, 'daily-records'],
    queryFn: () => apiFetch<BroilerDailyRecord[]>(`/broiler-batches/${batchId}/daily-records`),
    enabled: !!batchId,
  });
}

export function useDailyRecord(batchId: string, dayNumber: number) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', batchId, 'daily-records', dayNumber],
    queryFn: () =>
      apiFetch<BroilerDailyRecord>(`/broiler-batches/${batchId}/daily-records/${dayNumber}`),
    enabled: !!batchId && dayNumber >= 1 && dayNumber <= 45,
  });
}

export function useUpdateDailyRecord(batchId: string, dayNumber: number) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDailyRecordInput) =>
      apiFetch<BroilerDailyRecord>(`/broiler-batches/${batchId}/daily-records/${dayNumber}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broiler-batches', batchId, 'daily-records'] });
      queryClient.invalidateQueries({ queryKey: ['broiler-batches', batchId] });
    },
  });
}

export function useMortalities(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', batchId, 'mortality'],
    queryFn: () => apiFetch<BroilerMortality[]>(`/broiler-batches/${batchId}/mortality`),
    enabled: !!batchId,
  });
}

export function useCreateMortality(batchId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMortalityInput) =>
      apiFetch<BroilerMortality>(`/broiler-batches/${batchId}/mortality`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broiler-batches', batchId, 'mortality'] });
      queryClient.invalidateQueries({ queryKey: ['broiler-batches', batchId] });
    },
  });
}

export function useHealthEvents(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['broiler-batches', batchId, 'health-events'],
    queryFn: () => apiFetch<BroilerHealthEvent[]>(`/broiler-batches/${batchId}/health-events`),
    enabled: !!batchId,
  });
}

const ACTIVE_BATCH_STATUSES = new Set([
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
]);

/** Agrégat "mortalité du jour" toutes bandes confondues — aucun champ
 * agrégé ni endpoint farm-wide côté API (voir DETTE_TECHNIQUE.md) : un
 * fetch par bande active ET dans son cycle (filtrée AVANT le fetch, pas
 * après, pour ne jamais agréger le J1/J45 d'une bande hors cycle dans
 * "aujourd'hui"). Arbitrage assumé contre la contrainte réseau permanente
 * de CLAUDE.md, borné par le nombre de bandes actives d'une ferme.
 * `enabled` doit être câblé sur BROILER_DAILY_RECORDS_READ par l'appelant
 * — un rôle qui a BROILER_BATCHES_READ mais pas ce code (ex.
 * Vendeur/Caisse) déclencherait sinon un 403 par bande active. */
export interface BroilerBatchMortalityToday {
  batch: BroilerBatchWithComputed;
  mortality: number;
}

/** Extrait de useTodayMortalityTotal (Lot Tableau de bord) — même
 * useQueries, détail par bande exposé pour identifier la bande la plus
 * touchée (KPI "Mortalité aujourd'hui" et sélection par défaut de la
 * courbe de croissance) sans dupliquer ce fetch. */
export function useTodayMortalityByBatch(
  batches: BroilerBatchWithComputed[] | undefined,
  enabled: boolean,
): BroilerBatchMortalityToday[] | undefined {
  const apiFetch = useApiFetch();
  const inCycleActiveBatches = enabled
    ? (batches ?? [])
        .filter((b) => ACTIVE_BATCH_STATUSES.has(b.status))
        .map((b) => ({ batch: b, dayNumber: computeDayNumber(b.arrivalDate) }))
        .filter(({ dayNumber }) => isDayNumberInCycle(dayNumber))
    : [];

  const results = useQueries({
    queries: inCycleActiveBatches.map(({ batch, dayNumber }) => ({
      queryKey: ['broiler-batches', batch.id, 'daily-records', dayNumber],
      queryFn: () =>
        apiFetch<BroilerDailyRecord>(`/broiler-batches/${batch.id}/daily-records/${dayNumber}`),
    })),
  });

  if (!enabled || batches === undefined || results.some((r) => r.isLoading)) return undefined;
  return inCycleActiveBatches.map(({ batch }, index) => ({
    batch,
    mortality: results[index]?.data?.mortalityQuantity ?? 0,
  }));
}

export function useTodayMortalityTotal(
  batches: BroilerBatchWithComputed[] | undefined,
  enabled: boolean,
) {
  const byBatch = useTodayMortalityByBatch(batches, enabled);
  if (byBatch === undefined) return undefined;
  return byBatch.reduce((sum, b) => sum + b.mortality, 0);
}

export function useCreateHealthEvent(batchId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHealthEventInput) =>
      apiFetch<BroilerHealthEvent>(`/broiler-batches/${batchId}/health-events`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broiler-batches', batchId, 'health-events'] });
    },
  });
}
