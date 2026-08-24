'use client';

import Link from 'next/link';
import type { BreederBatchStatus, BreederBatchWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUsers } from '@/features/users/hooks';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const breederBatchStatusConfig: Record<BreederBatchStatus, { label: string; tone: Tone }> = {
  ACTIF: { label: 'Actif', tone: 'success' },
  REFORME: { label: 'Réforme', tone: 'warning' },
  CLOTURE: { label: 'Clôturé', tone: 'muted' },
  ANNULEE: { label: 'Annulée', tone: 'destructive' },
};

interface BreederBatchTableProps {
  data: BreederBatchWithComputed[] | undefined;
  isLoading: boolean;
}

export function BreederBatchTable({ data, isLoading }: BreederBatchTableProps) {
  const { data: users } = useUsers();
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));

  const columns: DataTableColumn<BreederBatchWithComputed>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (b) => (
        <Link href={`/reproducteurs/${b.id}`} className="font-medium text-primary hover:underline">
          {b.code}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (b) => (
        <StatusBadge
          label={breederBatchStatusConfig[b.status].label}
          tone={breederBatchStatusConfig[b.status].tone}
        />
      ),
    },
    {
      key: 'headcount',
      header: 'Effectif',
      render: (b) => `${b.femaleCount.toLocaleString('fr-FR')} F / ${b.maleCount.toLocaleString('fr-FR')} M`,
    },
    {
      key: 'available-eggs',
      header: 'Œufs fécondés disponibles',
      render: (b) => b.availableFertileEggs.toLocaleString('fr-FR'),
    },
    {
      key: 'responsible',
      header: 'Responsable',
      render: (b) => usersById.get(b.primaryManagerId) ?? '—',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(b) => b.id}
      emptyLabel="Aucun lot pour le moment."
    />
  );
}
