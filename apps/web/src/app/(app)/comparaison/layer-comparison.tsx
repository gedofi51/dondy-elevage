'use client';

import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { BatchPerformanceScore, LayerBatchClosureSummary } from '@dondy-elevage/shared-types';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { Skeleton } from '@/components/ui/skeleton';
import { Can } from '@/components/shared/permission-gate';
import { useApiFetch } from '@/lib/api/use-api-fetch';
import { useLayerBatches } from '@/features/layer-batches/hooks';
import { LayerPerformanceCoefficientsForm } from '@/features/layer-batches/components/performance-coefficients-form';
import { EntitySelector } from './entity-selector';
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from './comparison-table';

function formatFcfa(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}
function formatPercent(value: number): string {
  return `${value.toFixed(1)} %`;
}

/** Même queryKey que useLayerBatchProfitability (features/layer-batches/hooks). */
function useLayerProfitabilities(ids: string[]) {
  const apiFetch = useApiFetch();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['layer-batches', id, 'profitability'],
      queryFn: () => apiFetch<LayerBatchClosureSummary>(`/layer-batches/${id}/profitability`),
    })),
  });
}

/** Score de performance (Lot 5) — même queryKey que
 * useLayerBatchPerformanceScore (features/layer-batches/hooks). */
function useLayerPerformanceScores(ids: string[]) {
  const apiFetch = useApiFetch();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['layer-batches', id, 'performance-score'],
      queryFn: () => apiFetch<BatchPerformanceScore>(`/layer-batches/${id}/performance-score`),
    })),
  });
}

/** Comparaison — Pondeuses (Lot 4). Réutilise GET /:id/profitability
 * (déjà exposé), même décision que Broiler. */
export function LayerComparison() {
  const { data: batches } = useLayerBatches();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const results = useLayerProfitabilities(selectedIds);
  const scoreResults = useLayerPerformanceScores(selectedIds);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const options = (batches ?? []).map((b) => ({ id: b.id, label: b.code }));
  const columns: ComparisonColumn[] = selectedIds.map((id) => ({
    key: id,
    label: batches?.find((b) => b.id === id)?.code ?? id,
  }));

  const isLoading = results.some((r) => r.isLoading) || scoreResults.some((r) => r.isLoading);
  const allLoaded =
    selectedIds.length >= 2 &&
    results.every((r) => r.data) &&
    scoreResults.every((r) => r.data);

  const rows: ComparisonRow[] = allLoaded
    ? [
        {
          key: 'headcount',
          label: 'Effectif actuel',
          values: results.map((r) => r.data!.production.currentHeadcount.toLocaleString('fr-FR')),
        },
        {
          key: 'eggs-laid',
          label: 'Œufs pondus cumulés',
          values: results.map((r) => r.data!.production.cumulativeEggsLaid.toLocaleString('fr-FR')),
        },
        {
          key: 'eggs-sellable',
          label: 'Œufs commercialisables cumulés',
          values: results.map((r) => r.data!.production.cumulativeEggsSellable.toLocaleString('fr-FR')),
        },
        {
          key: 'laying-rate',
          label: 'Taux de ponte moyen',
          values: results.map((r) => formatPercent(r.data!.production.averageLayingRatePercent)),
        },
        {
          key: 'mortality-rate',
          label: 'Taux de mortalité cumulé',
          values: results.map((r) => formatPercent(r.data!.performance.cumulativeMortalityRate)),
        },
        {
          key: 'expenses',
          label: 'Charges totales',
          values: results.map((r) => formatFcfa(r.data!.finances.totalExpensesFcfa)),
        },
        {
          key: 'revenue',
          label: 'Chiffre d’affaires',
          values: results.map((r) => formatFcfa(r.data!.finances.revenueFcfa)),
        },
        {
          key: 'margin',
          label: 'Marge brute',
          values: results.map((r) => formatFcfa(r.data!.finances.grossMarginFcfa)),
        },
        {
          key: 'cost-per-egg',
          label: 'Coût par œuf',
          values: results.map((r) => formatFcfa(r.data!.finances.costPerEggFcfa)),
        },
        {
          key: 'performance-score',
          label: 'Score de performance',
          values: scoreResults.map((r) =>
            r.data!.scoreOn100 !== null
              ? `${r.data!.scoreOn100.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} / 100`
              : '—',
          ),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <EntitySelector options={options} selectedIds={selectedIds} onToggle={toggle} />
      {selectedIds.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Sélectionnez au moins 2 lots pour comparer leurs indicateurs.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <ComparisonTable columns={columns} rows={rows} />
      )}

      <Can permission={PERMISSIONS.FARMS_UPDATE}>
        <LayerPerformanceCoefficientsForm />
      </Can>
    </div>
  );
}
