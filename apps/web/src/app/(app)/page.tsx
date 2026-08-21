'use client';

import { Droplets, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { AlertBadge } from '@/components/shared/alert-badge';
import { Can } from '@/components/shared/permission-gate';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useWaterPoints } from '@/features/water-points/hooks';
import { useAlerts } from '@/features/alerts/hooks';

export default function DashboardPage() {
  const { data: waterPoints } = useWaterPoints();
  const activeWaterPoints = waterPoints?.filter((wp) => wp.status === 'ACTIF').length ?? '—';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble — étoffée module par module au fil des prochaines phases."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Points d'eau actifs" value={activeWaterPoints} icon={Droplets} tone="info" />
      </div>

      <Can permission={PERMISSIONS.ALERTS_READ}>
        <AlertsWidget />
      </Can>
    </div>
  );
}

function AlertsWidget() {
  const { data } = useAlerts({ status: 'TRIGGERED', limit: 5 });
  const alerts = data?.items ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />
        Alertes actives
      </h2>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune alerte active.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{alert.title}</span>
              <AlertBadge severity={alert.severity} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
