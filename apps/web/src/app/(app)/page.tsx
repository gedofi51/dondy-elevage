'use client';

import { Boxes, Droplets, EggFried, Feather, Package, Receipt, ShoppingCart, TrendingUp, Wallet, Wrench } from 'lucide-react';
import { KpiCard } from '@/components/shared/kpi-card';
import { Can } from '@/components/shared/permission-gate';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useAuth } from '@/components/providers/auth-provider';
import { useWaterPoints } from '@/features/water-points/hooks';
import { useAlerts } from '@/features/alerts/hooks';
import { useBroilerBatches } from '@/features/broiler-batches/hooks';
import { useLayerBatches } from '@/features/layer-batches/hooks';
import { useBreederBatches } from '@/features/breeder-batches/hooks';
import { useIncubationBatches } from '@/features/incubation-batches/hooks';
import { computeHatchRatePercent } from '@/features/incubation-batches/kpi';
import { useItems } from '@/features/items/hooks';
import { StockForecastWidget } from '@/features/items/components/stock-forecast-widget';
import { useTreasuryPayables, useTreasurySummary } from '@/features/treasury/hooks';
import { useAssets } from '@/features/assets/hooks';
import { useMaintenanceTasks } from '@/features/maintenance/hooks';
import { DashboardHeader, type DashboardSearchEntry } from '@/features/dashboard/components/dashboard-header';
import { DashboardPrimaryKpis } from '@/features/dashboard/components/dashboard-kpi-row';
import { DashboardGrowthChartCard } from '@/features/dashboard/components/dashboard-growth-chart-card';
import { DashboardBatchesTable } from '@/features/dashboard/components/dashboard-batches-table';
import { DashboardAlertsPanel } from '@/features/dashboard/components/dashboard-alerts-panel';
import { DashboardInfrastructurePanel } from '@/features/dashboard/components/dashboard-infrastructure-panel';

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

/**
 * Tableau de bord — refonte "Agritech Premium" (maquette 1a,
 * `docs/design/DONDY ELEVAGE - 5 directions.html`). Remaniement de
 * présentation uniquement : chaque bloc consomme des données déjà
 * exposées par l'API existante, aucun nouvel endpoint. Palette du mockup
 * déjà globale depuis la Phase 10 (voir DESIGN_SYSTEM.md) — pas de style
 * local ici, seule la disposition change.
 *
 * Écarts signalés (aucune donnée fictive, voir DETTE_TECHNIQUE.md pour le
 * détail) : pas de variation hebdomadaire sur "Cheptel actuel", pas de
 * ligne "Objectif" sur la courbe de croissance, pas de "Poids" réel pour
 * les lignes Pondeuses du tableau des bandes, "Voir tout" remplacé par
 * deux liens explicites, avatar utilisateur remplacé par le rôle (aucun
 * nom d'utilisateur disponible côté API).
 *
 * `BroilerBatchKpis`/`LayerBatchKpis` (effectif/mortalité/production par
 * type, ancien dashboard) retirés : redondants avec les nouvelles cartes
 * combinées "Cheptel actuel"/"Bandes actives"/"Mortalité aujourd'hui"/
 * "Production d'œufs" ci-dessous, qui couvrent exactement la même donnée.
 * Tous les autres indicateurs existants (eau, reproducteurs, couvoir,
 * stocks en alerte, trésorerie, patrimoine, maintenance) sont conservés
 * tels quels dans la section "Autres indicateurs".
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const canReadBroiler = user?.permissions.includes(PERMISSIONS.BROILER_BATCHES_READ) ?? false;
  const canReadLayer = user?.permissions.includes(PERMISSIONS.LAYER_BATCHES_READ) ?? false;
  const canReadBreeder = user?.permissions.includes(PERMISSIONS.BREEDER_BATCHES_READ) ?? false;
  const canReadIncubation = user?.permissions.includes(PERMISSIONS.INCUBATION_BATCHES_READ) ?? false;
  const canReadAlerts = user?.permissions.includes(PERMISSIONS.ALERTS_READ) ?? false;
  const canReadAssets = user?.permissions.includes(PERMISSIONS.ASSETS_READ) ?? false;

  const { data: broilerBatches } = useBroilerBatches({ enabled: canReadBroiler });
  const { data: layerBatches } = useLayerBatches({ enabled: canReadLayer });
  const { data: breederBatches } = useBreederBatches({ enabled: canReadBreeder });
  const { data: incubationBatches } = useIncubationBatches({ enabled: canReadIncubation });
  const { data: alertsData } = useAlerts({ status: 'TRIGGERED', limit: 5, enabled: canReadAlerts });
  const { data: assets } = useAssets({ enabled: canReadAssets });
  const { data: waterPoints } = useWaterPoints();

  const alerts = alertsData?.items ?? [];
  const activeBatchCount =
    canReadBroiler && canReadLayer && broilerBatches && layerBatches
      ? broilerBatches.filter((b) => ACTIVE_BROILER_STATUSES.has(b.status)).length +
        layerBatches.filter((b) => ACTIVE_LAYER_STATUSES.has(b.status)).length
      : undefined;

  const searchIndex: DashboardSearchEntry[] = [
    ...(broilerBatches ?? []).map((b) => ({
      id: b.id,
      code: b.code,
      typeLabel: 'Chair',
      href: `/poulets-chair/${b.id}`,
    })),
    ...(layerBatches ?? []).map((b) => ({
      id: b.id,
      code: b.code,
      typeLabel: 'Pondeuses',
      href: `/pondeuses/${b.id}`,
    })),
    ...(breederBatches ?? []).map((b) => ({
      id: b.id,
      code: b.code,
      typeLabel: 'Reproducteurs',
      href: `/reproducteurs/${b.id}`,
    })),
    ...(incubationBatches ?? []).map((b) => ({
      id: b.id,
      code: b.code,
      typeLabel: 'Couvoir',
      href: `/couvoir/${b.id}`,
    })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Hors du flux défilant ci-dessous (comme AppTopbar sur les autres
          écrans) — jamais un enfant "sticky" du contenu : c'est la seule
          façon que l'ascenseur ne couvre jamais cette ligne (voir
          app-shell.tsx). */}
      <div className="shrink-0 border-b border-border bg-background p-4 md:p-6">
        <DashboardHeader
          activeBatchCount={activeBatchCount}
          searchIndex={searchIndex}
          alertsCount={alerts.length}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
        <div className="flex flex-col gap-6">
          <DashboardPrimaryKpis />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr] xl:items-start">
            <div className="flex flex-col gap-5">
              {canReadBroiler ? (
                <DashboardGrowthChartCard broilerBatches={broilerBatches} alerts={alerts} />
              ) : null}
              {canReadBroiler || canReadLayer ? (
                <DashboardBatchesTable
                  broilerBatches={broilerBatches}
                  layerBatches={layerBatches}
                  alerts={alerts}
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-5">
              <Can permission={PERMISSIONS.ALERTS_READ}>
                <DashboardAlertsPanel alerts={alerts} />
              </Can>
              <Can permission={PERMISSIONS.ASSETS_READ}>
                <DashboardInfrastructurePanel assets={assets} />
              </Can>
              <Can permission={PERMISSIONS.ITEMS_READ}>
                <StockForecastWidget />
              </Can>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold text-primary">Autres indicateurs</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Points d'eau actifs"
                value={waterPoints?.filter((wp) => wp.status === 'ACTIF').length ?? '—'}
                icon={Droplets}
                tone="info"
              />
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
          </div>
        </div>
      </div>
    </div>
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
