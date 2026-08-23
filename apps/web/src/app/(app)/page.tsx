'use client';

import { Bird, Droplets, Egg, HeartPulse, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { AlertBadge } from '@/components/shared/alert-badge';
import { Can } from '@/components/shared/permission-gate';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useAuth } from '@/components/providers/auth-provider';
import { useWaterPoints } from '@/features/water-points/hooks';
import { useAlerts } from '@/features/alerts/hooks';
import { useBroilerBatches, useTodayMortalityTotal } from '@/features/broiler-batches/hooks';
import { useLayerBatches, useTodayEggProductionTotal } from '@/features/layer-batches/hooks';

const ACTIVE_BROILER_STATUSES = new Set([
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
]);

const ACTIVE_LAYER_STATUSES = new Set(['ELEVAGE', 'PONTE']);

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
        <Can permission={PERMISSIONS.BROILER_BATCHES_READ}>
          <BroilerBatchKpis />
        </Can>
        <Can permission={PERMISSIONS.LAYER_BATCHES_READ}>
          <LayerBatchKpis />
        </Can>
      </div>

      <Can permission={PERMISSIONS.ALERTS_READ}>
        <AlertsWidget />
      </Can>
    </div>
  );
}

function BroilerBatchKpis() {
  const { user } = useAuth();
  const canReadDailyRecords = user?.permissions.includes(PERMISSIONS.BROILER_DAILY_RECORDS_READ) ?? false;
  const { data: batches } = useBroilerBatches();
  const activeBatches = batches?.filter((b) => ACTIVE_BROILER_STATUSES.has(b.status)).length ?? '—';
  const totalHeadcount = batches?.reduce((sum, b) => sum + b.currentHeadcount, 0) ?? '—';
  const todayMortality = useTodayMortalityTotal(batches, canReadDailyRecords);

  return (
    <>
      <KpiCard label="Bandes de chair actives" value={activeBatches} icon={Bird} tone="info" />
      <KpiCard label="Effectif vivant (chair)" value={totalHeadcount} unit="sujets" icon={Bird} />
      <Can permission={PERMISSIONS.BROILER_DAILY_RECORDS_READ}>
        <KpiCard
          label="Mortalité du jour (chair)"
          value={todayMortality ?? '—'}
          icon={HeartPulse}
          tone={typeof todayMortality === 'number' && todayMortality > 0 ? 'destructive' : 'default'}
        />
      </Can>
    </>
  );
}

function LayerBatchKpis() {
  const { user } = useAuth();
  const canReadDailyRecords = user?.permissions.includes(PERMISSIONS.LAYER_DAILY_RECORDS_READ) ?? false;
  const { data: batches } = useLayerBatches();
  const activeBatches = batches?.filter((b) => ACTIVE_LAYER_STATUSES.has(b.status)).length ?? '—';
  const totalHeadcount = batches?.reduce((sum, b) => sum + b.currentHeadcount, 0) ?? '—';
  const todayEggProduction = useTodayEggProductionTotal(batches, canReadDailyRecords);

  return (
    <>
      <KpiCard label="Lots de pondeuses actifs" value={activeBatches} icon={Egg} tone="info" />
      <KpiCard label="Effectif total (pondeuses)" value={totalHeadcount} unit="poules" icon={Egg} />
      <Can permission={PERMISSIONS.LAYER_DAILY_RECORDS_READ}>
        <KpiCard
          label="Production d’œufs du jour"
          value={todayEggProduction ?? '—'}
          unit="œufs"
          icon={Egg}
        />
      </Can>
    </>
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
