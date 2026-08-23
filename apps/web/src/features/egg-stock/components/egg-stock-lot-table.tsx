'use client';

import type { EggStockLotWithRemaining } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';

/** Triée par productionDate croissant côté serveur (ordre FIFO) — le
 * premier lot de la liste EST le prochain consommé à la vente, pas besoin
 * d'un indicateur dédié (voir DETTE_TECHNIQUE.md). Calibre affiché tel
 * quel ("non_calibre" par défaut) : aucun sélecteur/filtre, hors périmètre
 * V1 côté API. */
export function EggStockLotTable({
  data,
  isLoading,
}: {
  data: EggStockLotWithRemaining[] | undefined;
  isLoading: boolean;
}) {
  const columns: DataTableColumn<EggStockLotWithRemaining>[] = [
    {
      key: 'productionDate',
      header: 'Date de production',
      render: (l) => new Date(l.productionDate).toLocaleDateString('fr-FR'),
    },
    { key: 'caliber', header: 'Calibre', render: (l) => (l.caliber === 'non_calibre' ? '—' : l.caliber) },
    { key: 'quantityProduced', header: 'Quantité produite', render: (l) => l.quantityProduced.toLocaleString('fr-FR') },
    { key: 'remaining', header: 'Restant', render: (l) => l.remaining.toLocaleString('fr-FR') },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(l) => l.id}
      emptyLabel="Aucun lot de stock d’œufs pour le moment."
    />
  );
}
