import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchClosureSummary,
  BroilerBatchWithComputed,
  BroilerDailyRecord,
  BroilerHealthEvent,
  BroilerMortality,
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
export function useTodayMortalityTotal(
  batches: BroilerBatchWithComputed[] | undefined,
  enabled: boolean,
) {
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
  return results.reduce((sum, r) => sum + (r.data?.mortalityQuantity ?? 0), 0);
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
