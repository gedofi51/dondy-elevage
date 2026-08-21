'use client';

import Link from 'next/link';
import type { WaterPoint, WaterPointStatus } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUsers } from '@/features/users/hooks';

const statusConfig: Record<WaterPointStatus, { label: string; tone: 'success' | 'muted' | 'warning' }> = {
  ACTIF: { label: 'Actif', tone: 'success' },
  SUSPENDU: { label: 'Suspendu', tone: 'muted' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
};

interface WaterPointTableProps {
  data: WaterPoint[] | undefined;
  isLoading: boolean;
}

export function WaterPointTable({ data, isLoading }: WaterPointTableProps) {
  const { data: users } = useUsers();
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));

  const columns: DataTableColumn<WaterPoint>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (wp) => (
        <Link href={`/points-eau/${wp.id}`} className="font-medium text-primary hover:underline">
          {wp.code}
        </Link>
      ),
    },
    { key: 'name', header: 'Nom', render: (wp) => wp.name },
    {
      key: 'status',
      header: 'Statut',
      render: (wp) => <StatusBadge label={statusConfig[wp.status].label} tone={statusConfig[wp.status].tone} />,
    },
    {
      key: 'tariff',
      header: 'Tarif',
      render: (wp) => `${wp.tariffFcfaPerM3.toLocaleString('fr-FR')} FCFA/m³`,
    },
    {
      key: 'responsible',
      header: 'Responsable',
      render: (wp) => usersById.get(wp.responsibleId) ?? '—',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(wp) => wp.id}
      emptyLabel="Aucun point d’eau pour le moment."
    />
  );
}
