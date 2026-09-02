'use client';

import Link from 'next/link';
import type { LayerBatchWithForecast } from '@/features/layer-batches/hooks';
import { useLayerBatchesWithForecast } from '@/features/layer-batches/hooks';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

/**
 * Prévisions production — Pondeuses (Lot 3). Une ligne par lot ELEVAGE/
 * PONTE (voir PROJECTABLE_LAYER_STATUSES côté service). Fenêtre glissante
 * de 30 jours (même convention que le Lot 2). Distinction visuelle
 * prévisionnel/réel : colonnes projetées en italique + "(estimé)".
 */
export function LayerForecastTable() {
  const { data, isLoading } = useLayerBatchesWithForecast();

  const columns: DataTableColumn<LayerBatchWithForecast>[] = [
    {
      key: 'code',
      header: 'Lot',
      render: (r) => (
        <Link href={`/pondeuses/${r.batch.id}`} className="font-medium text-primary hover:underline">
          {r.batch.code}
        </Link>
      ),
    },
    {
      key: 'headcount',
      header: 'Effectif actuel',
      render: (r) => r.batch.currentHeadcount.toLocaleString('fr-FR'),
    },
    {
      key: 'dataStatus',
      header: 'Données (30j)',
      render: (r) => (
        <StatusBadge
          label={r.forecast.dataStatus === 'SUFFISANT' ? 'Suffisantes' : 'Insuffisantes'}
          tone={r.forecast.dataStatus === 'SUFFISANT' ? 'info' : 'muted'}
        />
      ),
    },
    {
      key: 'averageEggs',
      header: 'Ponte moy./j (estimée)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast.averageDailyEggs != null
          ? r.forecast.averageDailyEggs.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
          : '—',
    },
    {
      key: 'projectedEggs',
      header: 'Œufs prévus / 30j (estimés)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast.projectedEggsNextWindow != null
          ? r.forecast.projectedEggsNextWindow.toLocaleString('fr-FR')
          : '—',
    },
    {
      key: 'layingRate',
      header: 'Taux de ponte prévu (estimé)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast.projectedLayingRatePercent != null
          ? `${r.forecast.projectedLayingRatePercent.toFixed(1)} %`
          : '—',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Projection des 30 prochains jours à partir de la ponte moyenne observée sur les 30
        derniers jours de chaque lot. Colonnes en italique = estimation.
      </p>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowKey={(r) => r.batch.id}
        emptyLabel="Aucun lot en élevage ou en ponte."
      />
    </div>
  );
}
