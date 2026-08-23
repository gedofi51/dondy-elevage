'use client';

import type { BroilerMortality, MortalityCause } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

const causeLabels: Record<MortalityCause, string> = {
  INCONNUE: 'Inconnue',
  MALADIE: 'Maladie',
  ACCIDENT: 'Accident',
  ETOUFFEMENT: 'Étouffement',
  CHALEUR: 'Chaleur',
  FROID: 'Froid',
  PROBLEME_ALIMENTAIRE: 'Problème alimentaire',
  PROBLEME_EAU: 'Problème eau',
  PREDATEUR: 'Prédateur',
  AUTRE: 'Autre',
};

interface MortalityTableProps {
  data: BroilerMortality[] | undefined;
  isLoading: boolean;
}

export function MortalityTable({ data, isLoading }: MortalityTableProps) {
  const columns: DataTableColumn<BroilerMortality>[] = [
    { key: 'day', header: 'Jour', render: (m) => `J${m.dayNumber}` },
    { key: 'date', header: 'Date', render: (m) => new Date(m.date).toLocaleDateString('fr-FR') },
    { key: 'quantity', header: 'Quantité', render: (m) => m.quantity },
    { key: 'cause', header: 'Cause', render: (m) => causeLabels[m.cause] },
    { key: 'observation', header: 'Observation', render: (m) => m.observation ?? '—' },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(m) => m.id}
      emptyLabel="Aucune mortalité détaillée saisie pour le moment."
    />
  );
}
