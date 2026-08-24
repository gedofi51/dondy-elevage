'use client';

import { TriangleAlert } from 'lucide-react';
import { AlertBadge } from '@/components/shared/alert-badge';
import { useAlerts } from '@/features/alerts/hooks';

/** Mutualisation Phase 14 — GET /alerts n'a pas de filtre serveur par
 * entityId (seulement status/limit) — filtrage côté client sur un lot
 * élargi d'alertes déclenchées, pas un vrai fetch scopé à l'entité.
 * Borné par `limit`, comme le widget du tableau de bord ; documenté
 * comme arbitrage réseau dans DETTE_TECHNIQUE.md. Anciennement
 * `BatchAlertsWidget` (Layer uniquement, Phase 12) — généralisé ici
 * (`entityId` au lieu de `batchId`) pour Item/PurchaseOrder, et ajouté
 * à Broiler dans le même mouvement (fermant le gap documenté Phase
 * 11/12 : jamais construit malgré le plan Chair qui le prévoyait). */
export function EntityAlertsWidget({ entityId }: { entityId: string }) {
  const { data } = useAlerts({ status: 'TRIGGERED', limit: 50 });
  const alerts = (data?.items ?? []).filter((a) => a.entityId === entityId);

  if (alerts.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />
        Alertes actives
      </h2>
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{alert.title}</span>
            <AlertBadge severity={alert.severity} />
          </li>
        ))}
      </ul>
    </section>
  );
}
