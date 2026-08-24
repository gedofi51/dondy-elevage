'use client';

import Link from 'next/link';
import type { Item, StockStatus } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const stockStatusConfig: Record<StockStatus, { label: string; tone: Tone }> = {
  VERT: { label: 'Stock normal', tone: 'success' },
  ORANGE: { label: 'Stock faible', tone: 'warning' },
  ROUGE: { label: 'Rupture', tone: 'destructive' },
};

interface ItemTableProps {
  data: Item[] | undefined;
  isLoading: boolean;
  rowActions?: (item: Item) => React.ReactNode;
}

export function ItemTable({ data, isLoading, rowActions }: ItemTableProps) {
  const columns: DataTableColumn<Item>[] = [
    {
      key: 'name',
      header: 'Nom',
      render: (i) => (
        <Link href={`/stocks/${i.id}`} className="font-medium text-primary hover:underline">
          {i.name}
        </Link>
      ),
    },
    { key: 'category', header: 'Catégorie', render: (i) => i.category },
    {
      key: 'stock',
      header: 'Stock',
      render: (i) => `${Number(i.currentStock).toLocaleString('fr-FR')} ${i.unit}`,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (i) => <StatusBadge label={stockStatusConfig[i.status].label} tone={stockStatusConfig[i.status].tone} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(i) => i.id}
      emptyLabel="Aucun article pour le moment."
      rowActions={rowActions}
    />
  );
}
