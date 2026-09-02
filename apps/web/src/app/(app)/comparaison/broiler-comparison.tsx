'use client';

import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { BatchClosureSummary } from '@dondy-elevage/shared-types';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiFetch } from '@/lib/api/use-api-fetch';
import { useBroilerBatches } from '@/features/broiler-batches/hooks';
import { EntitySelector } from './entity-selector';
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from './comparison-table';

function formatFcfa(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}
function formatPercent(value: number): string {
  return `${value.toFixed(1)} %`;
}

/** Même queryKey que useBatchProfitability (features/broiler-batches/hooks)
 * — cache React Query partagé, un seul fetch même si l'utilisateur a déjà
 * consulté la fiche de la bande. */
function useBroilerProfitabilities(ids: string[]) {
  const apiFetch = useApiFetch();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['broiler-batches', id, 'profitability'],
      queryFn: () => apiFetch<BatchClosureSummary>(`/broiler-batches/${id}/profitability`),
    })),
  });
}

/**
 * Comparaison — Poulets de chair (Lot 4). Pas de nouvel endpoint : réutilise
 * GET /:id/profitability (déjà exposé) pour chaque bande sélectionnée —
 * décision Lot 4, voir DETTE_TECHNIQUE.md.
 */
export function BroilerComparison() {
  const { data: batches } = useBroilerBatches();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const results = useBroilerProfitabilities(selectedIds);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const options = (batches ?? []).map((b) => ({ id: b.id, label: b.code }));
  const columns: ComparisonColumn[] = selectedIds.map((id) => ({
    key: id,
    label: batches?.find((b) => b.id === id)?.code ?? id,
  }));

  const isLoading = results.some((r) => r.isLoading);
  const allLoaded = selectedIds.length >= 2 && results.every((r) => r.data);

  const rows: ComparisonRow[] = allLoaded
    ? [
        {
          key: 'started',
          label: 'Effectif démarré',
          values: results.map((r) => r.data!.production.startedQuantity.toLocaleString('fr-FR')),
        },
        {
          key: 'mortality-cumulative',
          label: 'Mortalité cumulée',
          values: results.map((r) => r.data!.production.cumulativeMortality.toLocaleString('fr-FR')),
        },
        {
          key: 'mortality-rate',
          label: 'Taux mortalité cumulé',
          values: results.map((r) => formatPercent(r.data!.performance.cumulativeMortalityRate)),
        },
        {
          key: 'weight',
          label: 'Poids moyen final',
          values: results.map((r) =>
            r.data!.performance.finalAverageWeightG != null
              ? `${(r.data!.performance.finalAverageWeightG / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`
              : '—',
          ),
        },
        {
          key: 'fcr',
          label: 'IC (indice de consommation)',
          values: results.map((r) =>
            r.data!.performance.feedConversionRatio.toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
          ),
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
          key: 'profitability',
          label: 'Rentabilité',
          values: results.map((r) => formatPercent(r.data!.finances.profitabilityRate)),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <EntitySelector options={options} selectedIds={selectedIds} onToggle={toggle} />
      {selectedIds.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Sélectionnez au moins 2 bandes pour comparer leurs indicateurs.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <ComparisonTable columns={columns} rows={rows} />
      )}
    </div>
  );
}
