'use client';

import type { DepreciationEntry } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

/** Lecture seule — le plan d'amortissement est généré atomiquement à la
 * création de l'actif, aucun endpoint de modification (voir
 * DETTE_TECHNIQUE.md Phase 16). */
export function DepreciationEntriesTable({
  data,
  isLoading,
}: {
  data: DepreciationEntry[] | undefined;
  isLoading: boolean;
}) {
  const columns: DataTableColumn<DepreciationEntry>[] = [
    { key: 'period', header: 'Période', render: (e) => `#${e.periodNumber}` },
    {
      key: 'periodStart',
      header: 'Du',
      render: (e) => new Date(e.periodStart).toLocaleDateString('fr-FR'),
    },
    {
      key: 'periodEnd',
      header: 'Au',
      render: (e) => new Date(e.periodEnd).toLocaleDateString('fr-FR'),
    },
    {
      key: 'dotation',
      header: 'Dotation',
      render: (e) => `${e.dotationFcfa.toLocaleString('fr-FR')} FCFA`,
    },
    {
      key: 'cumulative',
      header: 'Cumul',
      render: (e) => `${e.cumulativeFcfa.toLocaleString('fr-FR')} FCFA`,
    },
    {
      key: 'netBookValue',
      header: 'VNC',
      render: (e) => `${e.netBookValueFcfa.toLocaleString('fr-FR')} FCFA`,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(e) => e.id}
      emptyLabel="Aucune ligne d’amortissement (base amortissable nulle)."
    />
  );
}
