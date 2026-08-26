'use client';

import type { SolarInfrastructureReading } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

export function SolarReadingTable({
  data,
  isLoading,
}: {
  data: SolarInfrastructureReading[] | undefined;
  isLoading: boolean;
}) {
  const columns: DataTableColumn<SolarInfrastructureReading>[] = [
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('fr-FR') },
    {
      key: 'production',
      header: 'Production journalière',
      render: (r) => (r.dailyProductionKwh === null ? '—' : `${Number(r.dailyProductionKwh)} kWh`),
    },
    {
      key: 'battery',
      header: 'Charge batterie',
      render: (r) => (r.batteryChargePercent === null ? '—' : `${Number(r.batteryChargePercent)} %`),
    },
    {
      key: 'power',
      header: 'Puissance instantanée',
      render: (r) => (r.instantaneousPowerKw === null ? '—' : `${Number(r.instantaneousPowerKw)} kW`),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(r) => r.id}
      emptyLabel="Aucun relevé d’infrastructure solaire."
    />
  );
}
