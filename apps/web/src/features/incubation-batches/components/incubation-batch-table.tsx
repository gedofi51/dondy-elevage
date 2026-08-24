'use client';

import Link from 'next/link';
import type { IncubationBatchStatus, IncubationBatchWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useBreederBatches } from '@/features/breeder-batches/hooks';
import { computeHatchRatePercent } from '../kpi';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const incubationBatchStatusConfig: Record<IncubationBatchStatus, { label: string; tone: Tone }> = {
  EN_INCUBATION: { label: 'En incubation', tone: 'info' },
  ECLOS: { label: 'Éclos', tone: 'success' },
  CLOTURE: { label: 'Clôturé', tone: 'muted' },
  ANNULEE: { label: 'Annulée', tone: 'destructive' },
};

interface IncubationBatchTableProps {
  data: IncubationBatchWithComputed[] | undefined;
  isLoading: boolean;
}

export function IncubationBatchTable({ data, isLoading }: IncubationBatchTableProps) {
  const { data: breederBatches } = useBreederBatches();
  const breederCodesById = new Map((breederBatches ?? []).map((b) => [b.id, b.code]));

  const columns: DataTableColumn<IncubationBatchWithComputed>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (b) => (
        <Link href={`/couvoir/${b.id}`} className="font-medium text-primary hover:underline">
          {b.code}
        </Link>
      ),
    },
    {
      key: 'breeder',
      header: 'Lot reproducteur',
      render: (b) => breederCodesById.get(b.breederBatchId) ?? '—',
    },
    {
      key: 'status',
      header: 'Statut',
      render: (b) => (
        <StatusBadge
          label={incubationBatchStatusConfig[b.status].label}
          tone={incubationBatchStatusConfig[b.status].tone}
        />
      ),
    },
    { key: 'eggCount', header: 'Œufs incubés', render: (b) => b.eggCount.toLocaleString('fr-FR') },
    {
      key: 'hatchRate',
      header: 'Taux d’éclosion',
      render: (b) =>
        b.chicksHatched != null ? `${computeHatchRatePercent(b.chicksHatched, b.eggCount).toFixed(1)} %` : '—',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(b) => b.id}
      emptyLabel="Aucun lot d’incubation pour le moment."
    />
  );
}
