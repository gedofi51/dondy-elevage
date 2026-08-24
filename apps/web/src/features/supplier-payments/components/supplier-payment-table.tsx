'use client';

import type { SupplierPayment } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

interface SupplierPaymentTableProps {
  data: SupplierPayment[] | undefined;
  isLoading: boolean;
  rowActions?: (payment: SupplierPayment) => React.ReactNode;
}

export function SupplierPaymentTable({ data, isLoading, rowActions }: SupplierPaymentTableProps) {
  const columns: DataTableColumn<SupplierPayment>[] = [
    { key: 'date', header: 'Date', render: (p) => new Date(p.date).toLocaleDateString('fr-FR') },
    { key: 'method', header: 'Mode', render: (p) => p.method },
    { key: 'amount', header: 'Montant', render: (p) => `${p.amountFcfa.toLocaleString('fr-FR')} FCFA` },
    { key: 'reference', header: 'Référence', render: (p) => p.reference ?? '—' },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(p) => p.id}
      emptyLabel="Aucun paiement pour le moment."
      rowActions={rowActions}
    />
  );
}
