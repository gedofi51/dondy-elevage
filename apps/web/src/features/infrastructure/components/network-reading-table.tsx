'use client';

import type { NetworkStatusReading } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { networkOperationalStatusLabels } from '../schemas';

const networkStatusTone: Record<NetworkStatusReading['operationalStatus'], 'success' | 'warning' | 'destructive'> = {
  OPERATIONNEL: 'success',
  DEGRADE: 'warning',
  HORS_LIGNE: 'destructive',
};

export function NetworkReadingTable({
  data,
  isLoading,
}: {
  data: NetworkStatusReading[] | undefined;
  isLoading: boolean;
}) {
  const columns: DataTableColumn<NetworkStatusReading>[] = [
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('fr-FR') },
    {
      key: 'status',
      header: 'Statut',
      render: (r) => (
        <StatusBadge
          label={networkOperationalStatusLabels[r.operationalStatus]}
          tone={networkStatusTone[r.operationalStatus]}
        />
      ),
    },
    { key: 'observations', header: 'Observations', render: (r) => r.observations ?? '—' },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(r) => r.id}
      emptyLabel="Aucun relevé de statut réseau."
    />
  );
}
