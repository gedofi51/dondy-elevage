'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QrCodeResolution, QrEntityType } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/**
 * Traduction entityType → route frontend — volontairement séparée du
 * contrat API (QrCodeResolution ne porte que entityType/entityId, voir
 * shared-types/qr-codes.ts) : c'est au frontend de savoir où vivent ses
 * propres pages, pas à l'API. Étendre ici pour tout futur type QR-able
 * confirmé — voir DETTE_TECHNIQUE.md pour Building/Incubator, reportés
 * faute de fiche de lecture.
 */
const QR_ENTITY_ROUTES: Record<QrEntityType, (id: string) => string> = {
  BROILER_BATCH: (id) => `/poulets-chair/${id}`,
  LAYER_BATCH: (id) => `/pondeuses/${id}`,
  ASSET: (id) => `/patrimoine/${id}`,
  ITEM: (id) => `/stocks/${id}`,
};

/**
 * Écran de résolution du scan (Lot 1) — le QR n'encode jamais qu'un jeton
 * opaque : cette page l'échange contre (entityType, entityId) auprès de
 * l'API (mêmes contrôles RBAC/farmId qu'un accès direct à la fiche) puis
 * redirige côté client. `handled` évite un double appel en dev (React
 * Strict Mode double-invoque les effets) — critique ici car chaque
 * résolution réussie journalise un scan, même patron que
 * oauth/callback/page.tsx.
 */
export function QrScanResolver({ token }: { token: string }) {
  const router = useRouter();
  const apiFetch = useApiFetch();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    apiFetch<QrCodeResolution>(`/qr-codes/resoudre/${token}`)
      .then((resolution) => {
        router.replace(QR_ENTITY_ROUTES[resolution.entityType](resolution.entityId));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setError('QR introuvable ou révoqué.');
        } else if (err instanceof ApiError && err.status === 403) {
          setError('Vous n’avez pas la permission de consulter cette fiche.');
        } else {
          setError('Une erreur est survenue pendant la résolution du QR.');
        }
      });
  }, [token, apiFetch, router]);

  if (error) {
    return <p className="text-center text-sm text-destructive">{error}</p>;
  }
  return <p className="text-center text-sm text-muted-foreground">Résolution du QR…</p>;
}
