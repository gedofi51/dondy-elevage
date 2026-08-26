'use client';

import type { WaterInfrastructureReadingWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

function fmtM3(value: string | null): string {
  return value === null ? '—' : `${Number(value).toLocaleString('fr-FR')} m³`;
}

/** Lecture seule — gapM3/soldVolumeM3 affichés tels que retournés par
 * l'API, jamais recalculés côté client (équation de contrôle V6 §5, voir
 * DETTE_TECHNIQUE.md Phase 18/19). */
export function WaterReadingTable({
  data,
  isLoading,
}: {
  data: WaterInfrastructureReadingWithComputed[] | undefined;
  isLoading: boolean;
}) {
  const columns: DataTableColumn<WaterInfrastructureReadingWithComputed>[] = [
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('fr-FR') },
    { key: 'pumped', header: 'Volume pompé', render: (r) => fmtM3(r.pumpedVolumeM3) },
    {
      key: 'reservoir',
      header: 'Niveau réservoir',
      render: (r) => (r.reservoirLevelPercent === null ? '—' : `${Number(r.reservoirLevelPercent)} %`),
    },
    { key: 'internalConsumption', header: 'Conso. ferme', render: (r) => fmtM3(r.farmInternalConsumptionM3) },
    { key: 'sold', header: 'Eau vendue', render: (r) => `${r.soldVolumeM3.toLocaleString('fr-FR')} m³` },
    {
      key: 'gap',
      header: 'Écart (équation de contrôle)',
      render: (r) =>
        r.gapM3 === null ? (
          '—'
        ) : (
          <span className={Math.abs(r.gapM3) > 0.5 ? 'font-medium text-warning' : undefined}>
            {r.gapM3.toLocaleString('fr-FR')} m³
          </span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(r) => r.id}
      emptyLabel="Aucun relevé d’infrastructure eau."
    />
  );
}
