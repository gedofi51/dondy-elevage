import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QrCodeGenerated, QrCodeStatus } from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/**
 * Segment de route API (anglais, `broiler-batches`/`layer-batches`/
 * `assets`/`items`) — DISTINCT du segment de route frontend (français,
 * `poulets-chair`/`pondeuses`/`patrimoine`/`stocks`), même découplage déjà
 * en place ailleurs (ex. useEmployeeAttendance appelle `/employees/:id/...`
 * alors que la page vit sous `/personnel`). Périmètre confirmé Lot 1 :
 * ces 4 entités seulement — voir DETTE_TECHNIQUE.md pour Building/
 * Incubator, reportés (aucune fiche de lecture existante).
 */
export type QrCodeApiSegment = 'broiler-batches' | 'layer-batches' | 'assets' | 'items';

export interface QrCodeScanEntry {
  id: string;
  scannedAt: string;
  scannedByUserId: string | null;
}

function qrCodeQueryKey(apiSegment: QrCodeApiSegment, entityId: string) {
  return [apiSegment, entityId, 'qr-code'] as const;
}

/** `null` tant qu'aucun QR n'a jamais été généré pour cette fiche —
 * distinct de `revoked: true` (un QR a existé, il est désactivé). */
export function useEntityQrCode(apiSegment: QrCodeApiSegment, entityId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: qrCodeQueryKey(apiSegment, entityId),
    queryFn: () => apiFetch<QrCodeStatus | null>(`/${apiSegment}/${entityId}/qr-code`),
    enabled: !!entityId,
  });
}

/** Chargé uniquement à la demande (voir QrCodePanel, bouton "Historique") —
 * pas de fetch systématique à chaque affichage de la fiche. */
export function useEntityQrCodeScans(apiSegment: QrCodeApiSegment, entityId: string, enabled: boolean) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: [...qrCodeQueryKey(apiSegment, entityId), 'scans'],
    queryFn: () => apiFetch<QrCodeScanEntry[]>(`/${apiSegment}/${entityId}/qr-code/scans`),
    enabled: enabled && !!entityId,
  });
}

function useGenerateOrRegenerateQrCode(apiSegment: QrCodeApiSegment, entityId: string, path: '' | '/regenerer') {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<QrCodeGenerated>(`/${apiSegment}/${entityId}/qr-code${path}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qrCodeQueryKey(apiSegment, entityId) }),
  });
}

/** Échoue (409) si un QR actif existe déjà — voir useRegenerateQrCode pour
 * le remplacer explicitement (même règle que côté API). */
export function useGenerateQrCode(apiSegment: QrCodeApiSegment, entityId: string) {
  return useGenerateOrRegenerateQrCode(apiSegment, entityId, '');
}

export function useRegenerateQrCode(apiSegment: QrCodeApiSegment, entityId: string) {
  return useGenerateOrRegenerateQrCode(apiSegment, entityId, '/regenerer');
}

export function useRevokeQrCode(apiSegment: QrCodeApiSegment, entityId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/${apiSegment}/${entityId}/qr-code/revoquer`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qrCodeQueryKey(apiSegment, entityId) }),
  });
}
