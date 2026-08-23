'use client';

import Link from 'next/link';
import type { BroilerDailyRecord } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

interface DailyRecordsTableProps {
  batchId: string;
  data: BroilerDailyRecord[] | undefined;
  isLoading: boolean;
}

export function DailyRecordsTable({ batchId, data, isLoading }: DailyRecordsTableProps) {
  const columns: DataTableColumn<BroilerDailyRecord>[] = [
    {
      key: 'day',
      header: 'Jour',
      render: (r) => (
        <Link href={`/poulets-chair/${batchId}/suivi/${r.dayNumber}`} className="font-medium text-primary hover:underline">
          J{r.dayNumber}
        </Link>
      ),
    },
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('fr-FR') },
    {
      key: 'status',
      header: 'État',
      render: (r) =>
        r.operatorId ? <StatusBadge label="Saisi" tone="success" /> : <StatusBadge label="Non saisi" tone="muted" />,
    },
    { key: 'mortality', header: 'Mortalité', render: (r) => r.mortalityQuantity },
    { key: 'avgWeight', header: 'Poids moyen', render: (r) => (r.averageWeightG != null ? `${r.averageWeightG} g` : '—') },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(r) => r.id}
      emptyLabel="Aucune ligne de suivi."
    />
  );
}
