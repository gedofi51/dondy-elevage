'use client';

import Link from 'next/link';
import type { Expense } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

interface ExpenseTableProps {
  data: Expense[] | undefined;
  isLoading: boolean;
  rowActions?: (expense: Expense) => React.ReactNode;
}

export function ExpenseTable({ data, isLoading, rowActions }: ExpenseTableProps) {
  const columns: DataTableColumn<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (e) => (
        <Link href={`/depenses/${e.id}/modifier`} className="font-medium text-primary hover:underline">
          {new Date(e.date).toLocaleDateString('fr-FR')}
        </Link>
      ),
    },
    { key: 'category', header: 'Catégorie', render: (e) => e.category },
    { key: 'description', header: 'Description', render: (e) => e.description ?? '—' },
    { key: 'amount', header: 'Montant', render: (e) => `${e.amountFcfa.toLocaleString('fr-FR')} FCFA` },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(e) => e.id}
      emptyLabel="Aucune dépense pour le moment."
      rowActions={rowActions}
    />
  );
}
