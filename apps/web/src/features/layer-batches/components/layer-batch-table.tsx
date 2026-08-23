'use client';

import Link from 'next/link';
import type { LayerBatchStatus, LayerBatchWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUsers } from '@/features/users/hooks';
import { computeCurrentAgeWeeks } from '../age';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const layerBatchStatusConfig: Record<LayerBatchStatus, { label: string; tone: Tone }> = {
  ELEVAGE: { label: 'Élevage', tone: 'info' },
  PONTE: { label: 'Ponte', tone: 'success' },
  REFORME: { label: 'Réforme', tone: 'warning' },
  CLOTURE: { label: 'Clôturé', tone: 'muted' },
  ANNULEE: { label: 'Annulée', tone: 'destructive' },
};

interface LayerBatchTableProps {
  data: LayerBatchWithComputed[] | undefined;
  isLoading: boolean;
}

// Pas de colonne "taux de ponte récent" ici : aucun champ agrégé côté API
// (LayerBatchWithComputed n'expose pas layingRate), l'ajouter obligerait un
// fetch daily-records par ligne (N+1) sur une liste déjà non paginée côté
// serveur — voir DETTE_TECHNIQUE.md. Affiché sur la fiche du lot à partir
// des données déjà chargées par l'onglet Suivi quotidien, sans coût réseau
// supplémentaire.
export function LayerBatchTable({ data, isLoading }: LayerBatchTableProps) {
  const { data: users } = useUsers();
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));

  const columns: DataTableColumn<LayerBatchWithComputed>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (b) => (
        <Link href={`/pondeuses/${b.id}`} className="font-medium text-primary hover:underline">
          {b.code}
        </Link>
      ),
    },
    {
      key: 'age',
      header: 'Âge',
      render: (b) => `${computeCurrentAgeWeeks(b.entryDate, b.ageAtEntryWeeks, b.ageAtEntryDays)} sem.`,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (b) => (
        <StatusBadge label={layerBatchStatusConfig[b.status].label} tone={layerBatchStatusConfig[b.status].tone} />
      ),
    },
    {
      key: 'headcount',
      header: 'Effectif actuel',
      render: (b) => b.currentHeadcount.toLocaleString('fr-FR'),
    },
    {
      key: 'responsible',
      header: 'Responsable',
      render: (b) => usersById.get(b.primaryManagerId) ?? '—',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(b) => b.id}
      emptyLabel="Aucun lot pour le moment."
    />
  );
}
