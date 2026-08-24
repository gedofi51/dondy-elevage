'use client';

import Link from 'next/link';
import type { ChickBatchStatus, ChickBatchWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const chickBatchStatusConfig: Record<ChickBatchStatus, { label: string; tone: Tone }> = {
  ACTIF: { label: 'Actif', tone: 'success' },
  CLOTURE: { label: 'Clôturé', tone: 'muted' },
  ANNULE: { label: 'Annulé', tone: 'destructive' },
};

const purposeLabels = { VENTE: 'Vente', RENOUVELLEMENT: 'Renouvellement' } as const;

interface ChickBatchTableProps {
  data: ChickBatchWithComputed[] | undefined;
  isLoading: boolean;
}

export function ChickBatchTable({ data, isLoading }: ChickBatchTableProps) {
  const columns: DataTableColumn<ChickBatchWithComputed>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (b) => (
        <Link href={`/poussins/${b.id}`} className="font-medium text-primary hover:underline">
          {b.code}
        </Link>
      ),
    },
    { key: 'purpose', header: 'Objet', render: (b) => purposeLabels[b.purpose] },
    {
      key: 'status',
      header: 'Statut',
      render: (b) => (
        <StatusBadge label={chickBatchStatusConfig[b.status].label} tone={chickBatchStatusConfig[b.status].tone} />
      ),
    },
    { key: 'quantity', header: 'Quantité initiale', render: (b) => b.initialQuantity.toLocaleString('fr-FR') },
    {
      key: 'headcount',
      header: 'Restant à vendre',
      render: (b) => (b.currentHeadcount != null ? b.currentHeadcount.toLocaleString('fr-FR') : '—'),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(b) => b.id}
      emptyLabel="Aucun lot de poussins pour le moment."
    />
  );
}
