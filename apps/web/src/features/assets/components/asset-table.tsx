'use client';

import Link from 'next/link';
import type { AssetStatus, AssetWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { assetCategoryLabels, type AssetCategory } from '../schemas';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const assetStatusConfig: Record<AssetStatus, { label: string; tone: Tone }> = {
  ACTIF: { label: 'Actif', tone: 'success' },
  HORS_SERVICE: { label: 'Hors service', tone: 'warning' },
  REFORME: { label: 'Réformé', tone: 'muted' },
};

function categoryLabel(category: string): string {
  return assetCategoryLabels[category as AssetCategory] ?? category;
}

interface AssetTableProps {
  data: AssetWithComputed[] | undefined;
  isLoading: boolean;
}

export function AssetTable({ data, isLoading }: AssetTableProps) {
  const columns: DataTableColumn<AssetWithComputed>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (a) => (
        <Link href={`/patrimoine/${a.id}`} className="font-medium text-primary hover:underline">
          {a.code}
        </Link>
      ),
    },
    { key: 'designation', header: 'Désignation', render: (a) => a.designation },
    { key: 'category', header: 'Catégorie', render: (a) => categoryLabel(a.category) },
    {
      key: 'status',
      header: 'Statut',
      render: (a) => (
        <StatusBadge label={assetStatusConfig[a.status].label} tone={assetStatusConfig[a.status].tone} />
      ),
    },
    {
      key: 'netBookValue',
      header: 'VNC',
      render: (a) => `${a.netBookValueFcfa.toLocaleString('fr-FR')} FCFA`,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(a) => a.id}
      emptyLabel="Aucun actif pour le moment."
    />
  );
}
