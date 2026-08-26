'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { MaintenanceTaskStatus, MaintenanceTaskWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const maintenanceTaskStatusConfig: Record<MaintenanceTaskStatus, { label: string; tone: Tone }> = {
  A_FAIRE: { label: 'À faire', tone: 'info' },
  EN_COURS: { label: 'En cours', tone: 'warning' },
  REALISEE: { label: 'Réalisée', tone: 'success' },
  ANNULEE: { label: 'Annulée', tone: 'muted' },
};

export const maintenanceTaskTypeLabels: Record<MaintenanceTaskWithComputed['type'], string> = {
  PREVENTIVE: 'Préventive',
  CORRECTIVE: 'Corrective',
  CONDITIONNELLE: 'Conditionnelle',
};

interface MaintenanceTaskTableProps {
  data: MaintenanceTaskWithComputed[] | undefined;
  isLoading: boolean;
  /** Page globale `/maintenance` uniquement — colonne + lien vers l'actif.
   * Composant partagé avec l'onglet fiche Asset (voir DETTE_TECHNIQUE.md
   * Phase 19, décision §A) pour une seule définition de colonnes/tri. */
  showAssetColumn?: boolean;
  assetLabelById?: Map<string, string>;
  rowActions?: (task: MaintenanceTaskWithComputed) => ReactNode;
}

export function MaintenanceTaskTable({
  data,
  isLoading,
  showAssetColumn = false,
  assetLabelById,
  rowActions,
}: MaintenanceTaskTableProps) {
  const columns: DataTableColumn<MaintenanceTaskWithComputed>[] = [
    ...(showAssetColumn
      ? [
          {
            key: 'asset',
            header: 'Actif',
            render: (t: MaintenanceTaskWithComputed) =>
              assetLabelById ? (
                <Link href={`/patrimoine/${t.assetId}`} className="text-primary hover:underline">
                  {assetLabelById.get(t.assetId) ?? t.assetId}
                </Link>
              ) : (
                '—'
              ),
          } satisfies DataTableColumn<MaintenanceTaskWithComputed>,
        ]
      : []),
    { key: 'designation', header: 'Désignation', render: (t) => t.designation },
    { key: 'type', header: 'Type', render: (t) => maintenanceTaskTypeLabels[t.type] },
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
          label={maintenanceTaskStatusConfig[t.status].label}
          tone={t.isLate ? 'destructive' : maintenanceTaskStatusConfig[t.status].tone}
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
      emptyLabel="Aucune tâche de maintenance."
      rowActions={rowActions}
    />
  );
}
