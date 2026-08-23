'use client';

import Link from 'next/link';
import type { LayerDailyRecord } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

interface DailyRecordsTableProps {
  batchId: string;
  data: LayerDailyRecord[] | undefined;
  isLoading: boolean;
}

export function DailyRecordsTable({ batchId, data, isLoading }: DailyRecordsTableProps) {
  const columns: DataTableColumn<LayerDailyRecord>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (r) => (
        <Link
          href={`/pondeuses/${batchId}/suivi/${r.date.slice(0, 10)}`}
          className="font-medium text-primary hover:underline"
        >
          {new Date(r.date).toLocaleDateString('fr-FR')}
        </Link>
      ),
    },
    { key: 'henCount', header: 'Effectif', render: (r) => r.henCount.toLocaleString('fr-FR') },
    { key: 'eggsLaid', header: 'Œufs pondus', render: (r) => r.eggsLaid.toLocaleString('fr-FR') },
    { key: 'eggsSellable', header: 'Commercialisables', render: (r) => r.eggsSellable.toLocaleString('fr-FR') },
    {
      key: 'layingRate',
      header: 'Taux de ponte',
      render: (r) => (r.layingRatePercent != null ? `${r.layingRatePercent} %` : '—'),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(r) => r.id}
      emptyLabel="Aucune journée de ponte saisie."
    />
  );
}
