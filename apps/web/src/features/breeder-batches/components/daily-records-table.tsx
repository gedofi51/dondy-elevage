'use client';

import Link from 'next/link';
import type { BreederDailyRecord } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

interface DailyRecordsTableProps {
  batchId: string;
  data: BreederDailyRecord[] | undefined;
  isLoading: boolean;
}

export function DailyRecordsTable({ batchId, data, isLoading }: DailyRecordsTableProps) {
  const columns: DataTableColumn<BreederDailyRecord>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (r) => (
        <Link
          href={`/reproducteurs/${batchId}/suivi/${r.date.slice(0, 10)}`}
          className="font-medium text-primary hover:underline"
        >
          {new Date(r.date).toLocaleDateString('fr-FR')}
        </Link>
      ),
    },
    { key: 'eggsLaid', header: 'Œufs pondus', render: (r) => r.eggsLaid.toLocaleString('fr-FR') },
    {
      key: 'eggsSelected',
      header: 'Sélectionnés incubation',
      render: (r) => r.eggsSelectedForIncubation.toLocaleString('fr-FR'),
    },
    { key: 'eggsRejected', header: 'Rejetés', render: (r) => r.eggsRejected.toLocaleString('fr-FR') },
    { key: 'eggsSold', header: 'Vendus', render: (r) => r.eggsSold.toLocaleString('fr-FR') },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(r) => r.id}
      emptyLabel="Aucune journée de production saisie."
    />
  );
}
