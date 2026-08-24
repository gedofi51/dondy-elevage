'use client';

import type { GoodsReceipt } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { useUsers } from '@/features/users/hooks';

interface ReceiptsTableProps {
  data: GoodsReceipt[] | undefined;
  isLoading: boolean;
}

export function ReceiptsTable({ data, isLoading }: ReceiptsTableProps) {
  const { data: users } = useUsers();
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));

  const columns: DataTableColumn<GoodsReceipt>[] = [
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('fr-FR') },
    { key: 'responsible', header: 'Responsable', render: (r) => usersById.get(r.responsibleId) ?? '—' },
    { key: 'observation', header: 'Observation', render: (r) => r.observation ?? '—' },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(r) => r.id}
      emptyLabel="Aucune réception pour le moment."
    />
  );
}
