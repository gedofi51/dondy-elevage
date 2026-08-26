import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssetWithComputed,
  CreateAssetInput,
  DepreciationEntry,
  ReformAssetInput,
  UpdateAssetInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useAssets(options?: { enabled?: boolean }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['assets'],
    queryFn: () => apiFetch<AssetWithComputed[]>('/assets'),
    enabled: options?.enabled,
  });
}

export function useAsset(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['assets', id],
    queryFn: () => apiFetch<AssetWithComputed>(`/assets/${id}`),
    enabled: !!id,
  });
}

export function useDepreciationEntries(assetId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['assets', assetId, 'depreciation-entries'],
    queryFn: () => apiFetch<DepreciationEntry[]>(`/assets/${assetId}/depreciation-entries`),
    enabled: !!assetId,
  });
}

export function useCreateAsset() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssetInput) =>
      apiFetch<AssetWithComputed>('/assets', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });
}

export function useUpdateAsset(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAssetInput) =>
      apiFetch<AssetWithComputed>(`/assets/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', id] });
    },
  });
}

export function useReformAsset(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReformAssetInput) =>
      apiFetch<AssetWithComputed>(`/assets/${id}/reformer`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', id] });
    },
  });
}

export function useDeleteAsset() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });
}
