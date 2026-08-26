'use client';

import {
  Bird,
  Boxes,
  Droplets,
  Egg,
  EggFried,
  Feather,
  HeartPulse,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Wrench,
} from 'lucide-react';
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
import { useBreederBatches } from '@/features/breeder-batches/hooks';
import { useIncubationBatches } from '@/features/incubation-batches/hooks';
import { computeHatchRatePercent } from '@/features/incubation-batches/kpi';
import { useItems } from '@/features/items/hooks';
import { useTreasuryPayables, useTreasurySummary } from '@/features/treasury/hooks';
import { useAssets } from '@/features/assets/hooks';
import { useMaintenanceTasks } from '@/features/maintenance/hooks';

const ACTIVE_BROILER_STATUSES = new Set([
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
]);

const ACTIVE_LAYER_STATUSES = new Set(['ELEVAGE', 'PONTE']);
const ACTIVE_BREEDER_STATUSES = new Set(['ACTIF', 'REFORME']);

// Même défaut que app/(app)/tresorerie/page.tsx (mois courant → aujourd'hui,
// aucun défaut serveur — GET /treasury/summary exige from/to explicites).
// Dupliqué localement plutôt que mutualisé : 2 usages seulement, sous le
// seuil retenu ailleurs dans le projet (voir DETTE_TECHNIQUE.md).
function firstDayOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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
        <Can permission={PERMISSIONS.BREEDER_BATCHES_READ}>
          <BreederBatchKpi />
        </Can>
        <Can permission={PERMISSIONS.INCUBATION_BATCHES_READ}>
          <IncubationBatchKpis />
        </Can>
        <Can permission={PERMISSIONS.ITEMS_READ}>
          <ItemsStockKpi />
        </Can>
        <Can permission={PERMISSIONS.TREASURY_READ}>
          <PayablesKpi />
        </Can>
        <Can permission={PERMISSIONS.TREASURY_READ}>
          <TreasuryKpis />
        </Can>
        <Can permission={PERMISSIONS.ASSETS_READ}>
          <AssetsKpi />
        </Can>
        <Can permission={PERMISSIONS.MAINTENANCE_TASKS_READ}>
          <MaintenanceKpi />
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

function BreederBatchKpi() {
  const { data: batches } = useBreederBatches();
  const activeBatches = batches?.filter((b) => ACTIVE_BREEDER_STATUSES.has(b.status)).length ?? '—';

  return (
    <KpiCard label="Lots reproducteurs actifs" value={activeBatches} icon={Feather} tone="info" />
  );
}

/** Taux d'éclosion moyen : calculé sur la liste déjà chargée pour le compte
 * "incubations en cours" (aucun fetch supplémentaire, contrairement au
 * "production du jour" côté Pondeuses qui nécessite un fetch par lot actif
 * — voir DETTE_TECHNIQUE.md Phase 12/13). Formule répliquée côté client,
 * jamais exposée par l'API (voir features/incubation-batches/kpi.ts). */
function IncubationBatchKpis() {
  const { data: batches } = useIncubationBatches();
  const inProgress = batches?.filter((b) => b.status === 'EN_INCUBATION').length ?? '—';
  const withBilan = (batches ?? []).filter((b) => b.chicksHatched !== null);
  const averageHatchRate =
    withBilan.length > 0
      ? withBilan.reduce((sum, b) => sum + computeHatchRatePercent(b.chicksHatched!, b.eggCount), 0) /
        withBilan.length
      : undefined;

  return (
    <>
      <KpiCard label="Incubations en cours" value={inProgress} icon={EggFried} tone="info" />
      <KpiCard
        label="Taux d’éclosion moyen"
        value={averageHatchRate != null ? `${averageHatchRate.toFixed(1)} %` : '—'}
        icon={EggFried}
      />
    </>
  );
}

function ItemsStockKpi() {
  const { data: items } = useItems();
  const inAlert = items?.filter((i) => i.status !== 'VERT').length ?? '—';

  return (
    <KpiCard
      label="Articles en alerte"
      value={inAlert}
      icon={Package}
      tone={typeof inAlert === 'number' && inAlert > 0 ? 'warning' : 'default'}
    />
  );
}

/** Un seul GET déjà agrégé côté serveur (GET /treasury/payables) — pas
 * d'arbitrage réseau coûteux, contrairement aux KPI "du jour" des modules
 * d'élevage (fetch par lot actif). */
function PayablesKpi() {
  const { data: payables } = useTreasuryPayables();
  const totalPayables = payables?.reduce((sum, p) => sum + p.balanceFcfa, 0);

  return (
    <KpiCard
      label="Dettes fournisseurs"
      value={totalPayables != null ? totalPayables.toLocaleString('fr-FR') : '—'}
      unit="FCFA"
      icon={Wallet}
    />
  );
}

/** Ventes/Dépenses/Marge (bilan frontend Phase 15, absents du dashboard
 * malgré des modules Ventes/Dépenses complets ailleurs dans l'app) — un
 * seul GET supplémentaire (`GET /treasury/summary`, déjà agrégé côté
 * serveur, même endpoint et même cache React Query que la page
 * Trésorerie), pas d'assemblage sales/expenses côté client. Période fixe
 * "mois courant", pas de sélecteur ici (même choix que les autres KPI du
 * dashboard, aucun n'a de sélecteur de période). */
function TreasuryKpis() {
  const from = firstDayOfCurrentMonthIso();
  const to = todayIsoDate();
  const { data: summary } = useTreasurySummary(from, to);

  return (
    <>
      <KpiCard
        label="Ventes du mois"
        value={summary ? summary.revenueFcfa.toLocaleString('fr-FR') : '—'}
        unit="FCFA"
        icon={ShoppingCart}
      />
      <KpiCard
        label="Dépenses du mois"
        value={summary ? summary.totalExpensesFcfa.toLocaleString('fr-FR') : '—'}
        unit="FCFA"
        icon={Receipt}
      />
      <KpiCard
        label="Marge brute du mois"
        value={summary ? summary.grossMarginFcfa.toLocaleString('fr-FR') : '—'}
        unit="FCFA"
        icon={TrendingUp}
        tone={summary && summary.grossMarginFcfa < 0 ? 'destructive' : 'default'}
      />
    </>
  );
}

/** VNC totale — un seul GET déjà utilisé par la page Patrimoine (React
 * Query partage le cache), pas d'arbitrage réseau supplémentaire. */
function AssetsKpi() {
  const { data: assets } = useAssets();
  const totalNetBookValue = assets?.reduce((sum, a) => sum + a.netBookValueFcfa, 0);

  return (
    <KpiCard
      label="Valeur nette du patrimoine"
      value={totalNetBookValue != null ? totalNetBookValue.toLocaleString('fr-FR') : '—'}
      unit="FCFA"
      icon={Boxes}
    />
  );
}

function MaintenanceKpi() {
  const { data: tasks } = useMaintenanceTasks();
  const lateTasks = tasks?.filter((t) => t.isLate).length ?? '—';

  return (
    <KpiCard
      label="Tâches de maintenance en retard"
      value={lateTasks}
      icon={Wrench}
      tone={typeof lateTasks === 'number' && lateTasks > 0 ? 'destructive' : 'default'}
    />
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
