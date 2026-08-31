'use client';

import type { ReactNode } from 'react';
import type { EmployeeTaskStatus, EmployeeTaskWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

// Miroir de maintenanceTaskStatusConfig (features/maintenance/components/
// maintenance-task-table.tsx) — même palette de tons pour les statuts
// communs aux deux modules de tâches du projet.
export const employeeTaskStatusConfig: Record<EmployeeTaskStatus, { label: string; tone: Tone }> = {
  A_FAIRE: { label: 'À faire', tone: 'info' },
  EN_COURS: { label: 'En cours', tone: 'warning' },
  REALISEE: { label: 'Réalisée', tone: 'success' },
  ANNULEE: { label: 'Annulée', tone: 'muted' },
};

interface EmployeeTaskTableProps {
  data: EmployeeTaskWithComputed[] | undefined;
  isLoading: boolean;
  rowActions?: (task: EmployeeTaskWithComputed) => ReactNode;
}

/** `isLate` rendu tel que calculé par l'API — jamais recalculé côté
 * front (règle UI explicite du Lot 6c), même patron que
 * MaintenanceTaskTable (Phase 17). */
export function EmployeeTaskTable({ data, isLoading, rowActions }: EmployeeTaskTableProps) {
  const columns: DataTableColumn<EmployeeTaskWithComputed>[] = [
    { key: 'designation', header: 'Désignation', render: (t) => t.designation },
    {
      key: 'dueDate',
      header: 'Échéance',
      render: (t) => (
        <span className={t.isLate ? 'font-medium text-destructive' : undefined}>
          {new Date(t.dueDate).toLocaleDateString('fr-FR')}
          {t.isLate ? ' — en retard' : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (t) => (
        <StatusBadge
          label={employeeTaskStatusConfig[t.status].label}
          tone={t.isLate ? 'destructive' : employeeTaskStatusConfig[t.status].tone}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(t) => t.id}
      emptyLabel="Aucune tâche assignée."
      rowActions={rowActions}
    />
  );
}
