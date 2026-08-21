'use client';

import type { Sale } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

const statusTone: Record<Sale['status'], 'success' | 'warning' | 'destructive' | 'muted' | 'default'> = {
  BROUILLON: 'muted',
  RESERVEE: 'default',
  CONFIRMEE: 'default',
  PAYEE: 'success',
  PARTIELLEMENT_PAYEE: 'warning',
  IMPAYEE: 'destructive',
  ANNULEE: 'muted',
};

const statusLabels: Record<Sale['status'], string> = {
  BROUILLON: 'Brouillon',
  RESERVEE: 'Réservée',
  CONFIRMEE: 'Confirmée',
  PAYEE: 'Payée',
  PARTIELLEMENT_PAYEE: 'Partiellement payée',
  IMPAYEE: 'Impayée',
  ANNULEE: 'Annulée',
};

export function SaleTable({ data, isLoading }: { data: Sale[] | undefined; isLoading: boolean }) {
  const columns: DataTableColumn<Sale>[] = [
    { key: 'saleNumber', header: 'N°', render: (s) => s.saleNumber },
    { key: 'date', header: 'Date', render: (s) => new Date(s.date).toLocaleDateString('fr-FR') },
    { key: 'quantity', header: 'Quantité', render: (s) => s.quantity },
    {
      key: 'netAmountFcfa',
      header: 'Montant net',
      render: (s) => `${s.netAmountFcfa.toLocaleString('fr-FR')} FCFA`,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (s) => <StatusBadge label={statusLabels[s.status]} tone={statusTone[s.status]} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(s) => s.id}
      emptyLabel="Aucune vente pour le moment."
    />
  );
}
