'use client';

import Link from 'next/link';
import type { BatchLineage, ChickTransformationType } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

const transformationLabels: Record<ChickTransformationType, string> = {
  CHAIR: 'Chair',
  RENOUVELLEMENT: 'Renouvellement',
  VENTE: 'Vente',
  REFORME_PERTE: 'Réforme / perte',
};

interface LineageTableProps {
  data: BatchLineage[] | undefined;
  isLoading: boolean;
}

/** Vue "amont" — tout ce qui a été orienté depuis un lot d'incubation. Le
 * lien vers l'entité enfant (chair/poussins) permet de suivre la filiation
 * dans l'autre sens depuis cette même table. */
export function LineageTable({ data, isLoading }: LineageTableProps) {
  const columns: DataTableColumn<BatchLineage>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (l) => new Date(l.date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'destination',
      header: 'Destination',
      render: (l) => transformationLabels[l.transformationType],
    },
    { key: 'quantity', header: 'Quantité', render: (l) => l.quantity.toLocaleString('fr-FR') },
    {
      key: 'target',
      header: 'Lot créé / motif',
      render: (l) => {
        if (l.childType === 'broiler_batch' && l.childId) {
          return (
            <Link href={`/poulets-chair/${l.childId}`} className="font-medium text-primary hover:underline">
              Voir la bande de chair
            </Link>
          );
        }
        if (l.childType === 'chick_batch' && l.childId) {
          return (
            <Link href={`/poussins/${l.childId}`} className="font-medium text-primary hover:underline">
              Voir le lot de poussins
            </Link>
          );
        }
        return l.reason ?? '—';
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(l) => l.id}
      emptyLabel="Aucune orientation pour le moment."
    />
  );
}
