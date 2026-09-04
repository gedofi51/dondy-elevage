'use client';

import { Bird, Egg, Package } from 'lucide-react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAuth } from '@/components/providers/auth-provider';
import { useBroilerBatches, useTodayMortalityByBatch } from '@/features/broiler-batches/hooks';
import { useLayerBatches, useTodayEggProductionTotal } from '@/features/layer-batches/hooks';
import { useItemsWithForecast } from '@/features/items/hooks';

const ACTIVE_BROILER_STATUSES = new Set([
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
]);
const ACTIVE_LAYER_STATUSES = new Set(['ELEVAGE', 'PONTE']);

/** Convention déjà en place ailleurs dans le projet (voir
 * features/broiler-batches/hooks.ts, commentaire sur ItemsStockKpi côté
 * page actuelle) : "aliments" identifie le poste alimentation via
 * `Item.category`, texte libre — pas d'enum dédié. */
function isFeedItem(category: string): boolean {
  return category.toLowerCase().includes('aliment');
}

/**
 * Les 5 cartes KPI de la maquette 1a (Cheptel/Bandes actives/Mortalité/
 * Aliment/Production d'œufs) — un seul composant plutôt que 5 : "Cheptel
 * actuel" et "Bandes actives" combinent Chair+Pondeuses, un composant par
 * carte dupliquerait les deux fetch de listes. RBAC : chaque carte reste
 * indépendamment gatée (un rôle sans LAYER_BATCHES_READ ne voit aucune
 * carte dépendant des pondeuses), la fonction ne fait qu'agréger ce que
 * l'utilisateur est effectivement autorisé à lire — jamais un total
 * masquant une donnée invisible pour ce rôle.
 *
 * Écart signalé (voir DETTE_TECHNIQUE.md) : la maquette affiche une
 * variation hebdomadaire sur "Cheptel actuel" ("+180 cette semaine") —
 * omise, aucune source fiable dans le projet sans un nouveau fetch par
 * bande sur 7 jours (coût réseau non justifié pour une carte, contexte
 * Samba).
 */
export function DashboardPrimaryKpis() {
  const { user } = useAuth();
  const canReadBroiler = user?.permissions.includes(PERMISSIONS.BROILER_BATCHES_READ) ?? false;
  const canReadLayer = user?.permissions.includes(PERMISSIONS.LAYER_BATCHES_READ) ?? false;
  const canReadBroilerDaily =
    user?.permissions.includes(PERMISSIONS.BROILER_DAILY_RECORDS_READ) ?? false;
  const canReadLayerDaily = user?.permissions.includes(PERMISSIONS.LAYER_DAILY_RECORDS_READ) ?? false;
  const canReadItems = user?.permissions.includes(PERMISSIONS.ITEMS_READ) ?? false;

  const { data: broilerBatches } = useBroilerBatches({ enabled: canReadBroiler });
  const { data: layerBatches } = useLayerBatches({ enabled: canReadLayer });
  const mortalityByBatch = useTodayMortalityByBatch(broilerBatches, canReadBroilerDaily);
  const todayEggProduction = useTodayEggProductionTotal(layerBatches, canReadLayerDaily);
  const { data: itemsWithForecast } = useItemsWithForecast();

  const activeBroiler = broilerBatches?.filter((b) => ACTIVE_BROILER_STATUSES.has(b.status));
  const activeLayer = layerBatches?.filter((b) => ACTIVE_LAYER_STATUSES.has(b.status));
  const bothListsLoaded = activeBroiler !== undefined && activeLayer !== undefined;

  const totalHeadcount =
    (activeBroiler?.reduce((sum, b) => sum + b.currentHeadcount, 0) ?? 0) +
    (activeLayer?.reduce((sum, b) => sum + b.currentHeadcount, 0) ?? 0);
  const activeBatchCount = (activeBroiler?.length ?? 0) + (activeLayer?.length ?? 0);

  const worstMortality = mortalityByBatch
    ?.filter((m) => m.mortality > 0)
    .sort((a, b) => b.mortality - a.mortality)[0];
  const todayMortalityTotal = mortalityByBatch?.reduce((sum, m) => sum + m.mortality, 0);

  const feedItems = (itemsWithForecast ?? []).filter(({ item }) => isFeedItem(item.category));
  const feedStockKg = feedItems
    .filter(({ item }) => item.unit === 'kg')
    .reduce((sum, { item }) => sum + Number(item.currentStock), 0);
  const feedAutonomyCandidates = feedItems.filter(
    ({ forecast }) => forecast?.dataStatus === 'SUFFISANT' && forecast.autonomyDays !== null,
  );
  const mostUrgentFeed =
    feedAutonomyCandidates.length > 0
      ? feedAutonomyCandidates.reduce((worst, current) =>
          current.forecast!.autonomyDays! < worst.forecast!.autonomyDays! ? current : worst,
        )
      : undefined;

  const totalLayerHeadcount = activeLayer?.reduce((sum, b) => sum + b.currentHeadcount, 0);
  const layingRatePercent =
    todayEggProduction !== undefined && totalLayerHeadcount && totalLayerHeadcount > 0
      ? (todayEggProduction / totalLayerHeadcount) * 100
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {canReadBroiler || canReadLayer ? (
        <KpiCard
          label="Cheptel actuel"
          value={bothListsLoaded ? totalHeadcount.toLocaleString('fr-FR') : '—'}
          unit="sujets"
          icon={Bird}
          hero
        />
      ) : null}

      {canReadBroiler || canReadLayer ? (
        <KpiCard
          label="Bandes actives"
          value={bothListsLoaded ? activeBatchCount : '—'}
          caption={
            bothListsLoaded
              ? `${activeBroiler!.length} chair · ${activeLayer!.length} ponte`
              : undefined
          }
          icon={Bird}
        />
      ) : null}

      {canReadBroilerDaily ? (
        <KpiCard
          label="Mortalité aujourd’hui"
          value={todayMortalityTotal ?? '—'}
          tone={typeof todayMortalityTotal === 'number' && todayMortalityTotal > 0 ? 'destructive' : 'default'}
          caption={worstMortality ? `▲ concentrée sur ${worstMortality.batch.code}` : undefined}
          captionTone="destructive"
        />
      ) : null}

      {canReadItems ? (
        <KpiCard
          label="Aliment disponible"
          value={
            feedStockKg > 0
              ? feedStockKg >= 1000
                ? `${(feedStockKg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} t`
                : `${feedStockKg.toLocaleString('fr-FR')} kg`
              : '—'
          }
          caption={mostUrgentFeed ? `${mostUrgentFeed.forecast!.autonomyDays} j d’autonomie` : undefined}
          captionTone="warning"
          icon={Package}
        />
      ) : null}

      {canReadLayerDaily ? (
        <KpiCard
          label="Production d’œufs"
          value={todayEggProduction ?? '—'}
          unit="/ jour"
          caption={
            layingRatePercent !== undefined
              ? `${layingRatePercent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de ponte`
              : undefined
          }
          captionTone="success"
          icon={Egg}
        />
      ) : null}
    </div>
  );
}
