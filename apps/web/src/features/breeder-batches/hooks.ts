import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BreederBatchWithComputed,
  BreederDailyRecord,
  CreateBreederBatchInput,
  CreateBreederDailyRecordInput,
  UpdateBreederBatchInput,
  UpdateBreederDailyRecordInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useBreederBatches() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['breeder-batches'],
    queryFn: () => apiFetch<BreederBatchWithComputed[]>('/breeder-batches'),
  });
}

export function useBreederBatch(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['breeder-batches', id],
    queryFn: () => apiFetch<BreederBatchWithComputed>(`/breeder-batches/${id}`),
    enabled: !!id,
  });
}

export function useCreateBreederBatch() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBreederBatchInput) =>
      apiFetch<BreederBatchWithComputed>('/breeder-batches', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breeder-batches'] }),
  });
}

export function useUpdateBreederBatch(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBreederBatchInput) =>
      apiFetch<BreederBatchWithComputed>(`/breeder-batches/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breeder-batches'] }),
  });
}

export function useBreederDailyRecords(batchId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['breeder-batches', batchId, 'daily-records'],
    queryFn: () => apiFetch<BreederDailyRecord[]>(`/breeder-batches/${batchId}/daily-records`),
    enabled: !!batchId,
  });
}

/** Comme useLayerDailyRecord (Phase 12) : un 404 est l'état NORMAL "pas
 * encore saisi ce jour-là" (formulaire de création), pas une erreur —
 * `retry: false` pour ne pas retarder l'affichage. */
export function useBreederDailyRecord(batchId: string, date: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['breeder-batches', batchId, 'daily-records', date],
    queryFn: () => apiFetch<BreederDailyRecord>(`/breeder-batches/${batchId}/daily-records/${date}`),
    enabled: !!batchId && !!date,
    retry: false,
  });
}

function invalidateDailyRecordQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  batchId: string,
  date: string,
) {
  queryClient.invalidateQueries({ queryKey: ['breeder-batches', batchId, 'daily-records'] });
  queryClient.invalidateQueries({ queryKey: ['breeder-batches', batchId, 'daily-records', date] });
  // eggsSelectedForIncubation alimente availableFertileEggs, affiché sur la
  // fiche du lot (KpiCard) et utilisé par le formulaire de création d'un
  // lot d'incubation.
  queryClient.invalidateQueries({ queryKey: ['breeder-batches', batchId] });
}

export function useCreateBreederDailyRecord(batchId: string, date: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBreederDailyRecordInput) =>
      apiFetch<BreederDailyRecord>(`/breeder-batches/${batchId}/daily-records`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => invalidateDailyRecordQueries(queryClient, batchId, date),
  });
}

export function useUpdateBreederDailyRecord(batchId: string, date: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBreederDailyRecordInput) =>
      apiFetch<BreederDailyRecord>(`/breeder-batches/${batchId}/daily-records/${date}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => invalidateDailyRecordQueries(queryClient, batchId, date),
  });
}
