'use client';

import Link from 'next/link';
import type { BroilerBatchWithForecast } from '@/features/broiler-batches/hooks';
import { useBroilerBatchesWithForecast } from '@/features/broiler-batches/hooks';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

/**
 * Prévisions production — Poulets de chair (Lot 3). Une ligne par bande en
 * cours de cycle (voir PROJECTABLE_BROILER_STATUSES côté service).
 * Distinction visuelle prévisionnel/réel (règle non négociable du prompt
 * Lot 3, même patron que StockForecastReport, Lot 2) : colonnes
 * projetées en italique + libellé "(estimé)", jamais un chiffre inventé
 * quand la donnée est insuffisante (— explicite).
 */
export function BroilerForecastTable() {
  const { data, isLoading } = useBroilerBatchesWithForecast();

  const columns: DataTableColumn<BroilerBatchWithForecast>[] = [
    {
      key: 'code',
      header: 'Bande',
      render: (r) => (
        <Link href={`/poulets-chair/${r.batch.id}`} className="font-medium text-primary hover:underline">
          {r.batch.code}
        </Link>
      ),
    },
    {
      key: 'days',
      header: 'Écoulés / restants',
      render: (r) => `${r.forecast.elapsedDays} j / ${r.forecast.remainingDays} j`,
    },
    {
      key: 'headcount',
      header: 'Effectif actuel',
      render: (r) => r.batch.currentHeadcount.toLocaleString('fr-FR'),
    },
    {
      key: 'mortalityStatus',
      header: 'Données mortalité',
      render: (r) => (
        <StatusBadge
          label={r.forecast.mortalityDataStatus === 'SUFFISANT' ? 'Suffisantes' : 'Insuffisantes'}
          tone={r.forecast.mortalityDataStatus === 'SUFFISANT' ? 'info' : 'muted'}
        />
      ),
    },
    {
      key: 'sellable',
      header: 'Effectif vendable prévu (estimé)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast.projectedSellableCount != null
          ? r.forecast.projectedSellableCount.toLocaleString('fr-FR')
          : '—',
    },
    {
      key: 'weightStatus',
      header: 'Données poids',
      render: (r) => (
        <StatusBadge
          label={r.forecast.weightDataStatus === 'SUFFISANT' ? 'Suffisantes' : 'Insuffisantes'}
          tone={r.forecast.weightDataStatus === 'SUFFISANT' ? 'info' : 'muted'}
        />
      ),
    },
    {
      key: 'weight',
      header: 'Poids final prévu (estimé)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast.projectedFinalWeightG != null
          ? `${(r.forecast.projectedFinalWeightG / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`
          : '—',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Projection jusqu’à la date de vente prévue, à partir de la tendance mortalité/croissance
        observée à ce jour sur chaque bande. Colonnes en italique = estimation, jamais une valeur
        garantie.
      </p>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowKey={(r) => r.batch.id}
        emptyLabel="Aucune bande en cours de cycle."
      />
    </div>
  );
}
