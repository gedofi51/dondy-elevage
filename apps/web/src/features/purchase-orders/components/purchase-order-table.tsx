'use client';

import Link from 'next/link';
import type { PurchaseOrderStatus, PurchaseOrderWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useSuppliers } from '@/features/suppliers/hooks';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const purchaseOrderStatusConfig: Record<PurchaseOrderStatus, { label: string; tone: Tone }> = {
  BROUILLON: { label: 'Brouillon', tone: 'muted' },
  COMMANDE: { label: 'Commandé', tone: 'info' },
  PARTIELLEMENT_RECU: { label: 'Partiellement reçu', tone: 'warning' },
  RECU: { label: 'Reçu', tone: 'success' },
  ANNULE: { label: 'Annulé', tone: 'destructive' },
};

interface PurchaseOrderTableProps {
  data: PurchaseOrderWithComputed[] | undefined;
  isLoading: boolean;
}

export function PurchaseOrderTable({ data, isLoading }: PurchaseOrderTableProps) {
  const { data: suppliers } = useSuppliers();
  const supplierNamesById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  const columns: DataTableColumn<PurchaseOrderWithComputed>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (o) => (
        <Link href={`/achats/${o.id}`} className="font-medium text-primary hover:underline">
          {o.code}
        </Link>
      ),
    },
    { key: 'supplier', header: 'Fournisseur', render: (o) => supplierNamesById.get(o.supplierId) ?? '—' },
    {
      key: 'status',
      header: 'Statut',
      render: (o) => (
        <StatusBadge label={purchaseOrderStatusConfig[o.status].label} tone={purchaseOrderStatusConfig[o.status].tone} />
      ),
    },
    { key: 'total', header: 'Montant', render: (o) => `${o.totalAmountFcfa.toLocaleString('fr-FR')} FCFA` },
    { key: 'balance', header: 'Solde restant', render: (o) => `${o.balanceFcfa.toLocaleString('fr-FR')} FCFA` },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(o) => o.id}
      emptyLabel="Aucune commande pour le moment."
    />
  );
}
