'use client';

import { TriangleAlert } from 'lucide-react';
import { AlertBadge } from '@/components/shared/alert-badge';
import { useAlerts } from '@/features/alerts/hooks';

/** GET /alerts n'a pas de filtre serveur par entityId (seulement
 * status/limit) — filtrage côté client sur un lot élargi d'alertes
 * déclenchées, pas un vrai fetch scopé au lot. Borné par `limit`, comme le
 * widget du tableau de bord ; documenté comme arbitrage réseau dans
 * DETTE_TECHNIQUE.md. */
export function BatchAlertsWidget({ batchId }: { batchId: string }) {
  const { data } = useAlerts({ status: 'TRIGGERED', limit: 50 });
  const alerts = (data?.items ?? []).filter((a) => a.entityId === batchId);

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
