'use client';

import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { IncubationBatchProfitability, IncubationBatchWithComputed } from '@dondy-elevage/shared-types';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiFetch } from '@/lib/api/use-api-fetch';
import { useIncubationBatches } from '@/features/incubation-batches/hooks';
import {
  computeFertileEggs,
  computeFertilityRatePercent,
  computeHatchRatePercent,
} from '@/features/incubation-batches/kpi';
import { EntitySelector } from './entity-selector';
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from './comparison-table';

function formatFcfa(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}
function formatPercent(value: number): string {
  return `${value.toFixed(1)} %`;
}

/** Mêmes queryKeys que useIncubationBatch/useIncubationBatchProfitability
 * (features/incubation-batches/hooks) — cache partagé. */
function useIncubationComparisonData(ids: string[]) {
  const apiFetch = useApiFetch();
  const batchResults = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['incubation-batches', id],
      queryFn: () => apiFetch<IncubationBatchWithComputed>(`/incubation-batches/${id}`),
    })),
  });
  const profitabilityResults = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['incubation-batches', id, 'profitability'],
      queryFn: () => apiFetch<IncubationBatchProfitability>(`/incubation-batches/${id}/profitability`),
    })),
  });
  return { batchResults, profitabilityResults };
}

/**
 * Comparaison — Couvoir (Lot 4). Décision Lot 4 (voir DETTE_TECHNIQUE.md) :
 * uniquement les couvoirs ÉCLOS — un IncubationBatch EN_INCUBATION n'a
 * aucun indicateur réel (chicksHatched/eggsInfertile renseignés
 * seulement à l'issue de l'éclosion), donc rien à comparer. Taux
 * d'éclosion/fécondité recalculés côté client (aucune route ne les
 * expose, voir kpi.ts — même duplication assumée que la fiche couvoir).
 */
export function IncubationComparison() {
  const { data: batches } = useIncubationBatches();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { batchResults, profitabilityResults } = useIncubationComparisonData(selectedIds);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const hatchedBatches = (batches ?? []).filter((b) => b.status === 'ECLOS');
  const options = hatchedBatches.map((b) => ({ id: b.id, label: b.code }));
  const columns: ComparisonColumn[] = selectedIds.map((id) => ({
    key: id,
    label: hatchedBatches.find((b) => b.id === id)?.code ?? id,
  }));

  const isLoading = batchResults.some((r) => r.isLoading) || profitabilityResults.some((r) => r.isLoading);
  const allLoaded =
    selectedIds.length >= 2 &&
    batchResults.every((r) => r.data) &&
    profitabilityResults.every((r) => r.data);

  const rows: ComparisonRow[] = allLoaded
    ? [
        {
          key: 'eggs',
          label: 'Œufs incubés',
          values: batchResults.map((r) => r.data!.eggCount.toLocaleString('fr-FR')),
        },
        {
          key: 'chicks',
          label: 'Poussins éclos',
          values: batchResults.map((r) => (r.data!.chicksHatched ?? 0).toLocaleString('fr-FR')),
        },
        {
          key: 'hatch-rate',
          label: 'Taux d’éclosion',
          values: batchResults.map((r) =>
            formatPercent(computeHatchRatePercent(r.data!.chicksHatched ?? 0, r.data!.eggCount)),
          ),
        },
        {
          key: 'fertility-rate',
          label: 'Taux de fécondité',
          values: batchResults.map((r) => {
            const fertileEggs = computeFertileEggs(r.data!.eggCount, r.data!.eggsInfertile ?? 0);
            return formatPercent(computeFertilityRatePercent(fertileEggs, r.data!.eggCount));
          }),
        },
        {
          key: 'expenses',
          label: 'Charges totales',
          values: profitabilityResults.map((r) => formatFcfa(r.data!.totalExpensesFcfa)),
        },
        {
          key: 'revenue',
          label: 'Chiffre d’affaires',
          values: profitabilityResults.map((r) => formatFcfa(r.data!.revenueFcfa)),
        },
        {
          key: 'margin',
          label: 'Marge brute',
          values: profitabilityResults.map((r) => formatFcfa(r.data!.grossMarginFcfa)),
        },
        {
          key: 'cost-per-chick',
          label: 'Coût par poussin',
          values: profitabilityResults.map((r) => formatFcfa(r.data!.costPerChickHatchedFcfa)),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Seuls les couvoirs déjà éclos sont comparables — un couvoir en cours d’incubation n’a pas encore
        de résultat réel.
      </p>
      <EntitySelector options={options} selectedIds={selectedIds} onToggle={toggle} />
      {selectedIds.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Sélectionnez au moins 2 couvoirs éclos pour comparer leurs indicateurs.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <ComparisonTable columns={columns} rows={rows} />
      )}
    </div>
  );
}
