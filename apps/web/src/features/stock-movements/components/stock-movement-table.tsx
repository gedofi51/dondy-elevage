'use client';

import type { StockMovement, StockMovementReason } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

const reasonLabels: Record<StockMovementReason, string> = {
  ACHAT: 'Achat',
  RETOUR: 'Retour',
  AJUSTEMENT: 'Ajustement',
  PRODUCTION_INTERNE: 'Production interne',
  DISTRIBUTION_BANDE: 'Distribution bande',
  VENTE: 'Vente',
  PERTE: 'Perte',
  CASSE: 'Casse',
  CONSOMMATION_INTERNE: 'Consommation interne',
};

interface StockMovementTableProps {
  data: StockMovement[] | undefined;
  isLoading: boolean;
}

export function StockMovementTable({ data, isLoading }: StockMovementTableProps) {
  const columns: DataTableColumn<StockMovement>[] = [
    { key: 'date', header: 'Date', render: (m) => new Date(m.date).toLocaleDateString('fr-FR') },
    {
      key: 'type',
      header: 'Sens',
      render: (m) => (
        <StatusBadge label={m.type === 'ENTREE' ? 'Entrée' : 'Sortie'} tone={m.type === 'ENTREE' ? 'success' : 'warning'} />
      ),
    },
    { key: 'reason', header: 'Motif', render: (m) => reasonLabels[m.reason] },
    { key: 'quantity', header: 'Quantité', render: (m) => Number(m.quantity).toLocaleString('fr-FR') },
    {
      key: 'value',
      header: 'Valeur',
      render: (m) => `${m.totalValueFcfa.toLocaleString('fr-FR')} FCFA`,
    },
    {
      key: 'origin',
      header: 'Origine',
      render: (m) => (m.sourceType ? 'Automatique' : 'Manuel'),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(m) => m.id}
      emptyLabel="Aucun mouvement pour le moment."
    />
  );
}
