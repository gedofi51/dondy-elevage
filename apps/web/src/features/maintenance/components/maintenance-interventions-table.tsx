'use client';

import type { MaintenanceInterventionWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

/** Historique en lecture seule — aucune modification/suppression
 * d'intervention côté API (voir DETTE_TECHNIQUE.md Phase 17). */
export function MaintenanceInterventionsTable({
  data,
  isLoading,
  taskLabelById,
}: {
  data: MaintenanceInterventionWithComputed[] | undefined;
  isLoading: boolean;
  taskLabelById?: Map<string, string>;
}) {
  const columns: DataTableColumn<MaintenanceInterventionWithComputed>[] = [
    {
      key: 'interventionDate',
      header: 'Date',
      render: (i) => new Date(i.interventionDate).toLocaleDateString('fr-FR'),
    },
    { key: 'diagnosis', header: 'Diagnostic', render: (i) => i.diagnosis ?? '—' },
    {
      key: 'task',
      header: 'Tâche liée',
      render: (i) => (i.taskId ? (taskLabelById?.get(i.taskId) ?? i.taskId) : '—'),
    },
    {
      key: 'partsCostFcfa',
      header: 'Coût pièces',
      render: (i) => `${i.partsCostFcfa.toLocaleString('fr-FR')} FCFA`,
    },
    {
      key: 'laborCostFcfa',
      header: 'Coût main-d’œuvre',
      render: (i) => `${i.laborCostFcfa.toLocaleString('fr-FR')} FCFA`,
    },
    {
      key: 'totalCostFcfa',
      header: 'Coût total',
      render: (i) => `${i.totalCostFcfa.toLocaleString('fr-FR')} FCFA`,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(i) => i.id}
      emptyLabel="Aucune intervention enregistrée."
    />
  );
}
