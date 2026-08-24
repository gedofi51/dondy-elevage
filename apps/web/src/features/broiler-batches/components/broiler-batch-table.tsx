'use client';

import Link from 'next/link';
import type { BroilerBatchStatus, BroilerBatchWithComputed } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUsers } from '@/features/users/hooks';
import { useBuildings } from '@/features/buildings/hooks';
import { computeDayNumber } from '../day-number';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const broilerBatchStatusConfig: Record<BroilerBatchStatus, { label: string; tone: Tone }> = {
  BROUILLON: { label: 'Brouillon', tone: 'muted' },
  PLANIFIEE: { label: 'Planifiée', tone: 'info' },
  EN_DEMARRAGE: { label: 'En démarrage', tone: 'info' },
  EN_CROISSANCE: { label: 'En croissance', tone: 'success' },
  EN_FINITION: { label: 'En finition', tone: 'success' },
  PRETE_A_VENDRE: { label: 'Prête à vendre', tone: 'warning' },
  EN_VENTE: { label: 'En vente', tone: 'warning' },
  VENDUE: { label: 'Vendue', tone: 'default' },
  CLOTUREE: { label: 'Clôturée', tone: 'muted' },
  ANNULEE: { label: 'Annulée', tone: 'destructive' },
};

interface BroilerBatchTableProps {
  data: BroilerBatchWithComputed[] | undefined;
  isLoading: boolean;
}

export function BroilerBatchTable({ data, isLoading }: BroilerBatchTableProps) {
  const { data: users } = useUsers();
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));
  // Vendeur/Caisse a BROILER_BATCHES_READ mais pas BUILDINGS_READ
  // (roles.catalog.ts) — isError distingue un 403 gracieux d'un chargement,
  // même patron que SupplierField (broiler-batch-form.tsx).
  const { data: buildings, isError: buildingsError } = useBuildings();
  const buildingsById = new Map((buildings ?? []).map((b) => [b.id, b.name]));

  const columns: DataTableColumn<BroilerBatchWithComputed>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (b) => (
        <Link href={`/poulets-chair/${b.id}`} className="font-medium text-primary hover:underline">
          {b.code}
        </Link>
      ),
    },
    {
      key: 'arrivalDate',
      header: 'Date d’arrivée',
      render: (b) => new Date(b.arrivalDate).toLocaleDateString('fr-FR'),
    },
    {
      key: 'age',
      header: 'Âge',
      render: (b) => {
        const day = computeDayNumber(b.arrivalDate);
        if (day < 1) return '—';
        return `J${Math.min(day, 45)}${day > 45 ? '+' : ''}`;
      },
    },
    {
      key: 'status',
      header: 'Statut',
      render: (b) => (
        <StatusBadge label={broilerBatchStatusConfig[b.status].label} tone={broilerBatchStatusConfig[b.status].tone} />
      ),
    },
    {
      key: 'headcount',
      header: 'Effectif vivant',
      render: (b) => b.currentHeadcount.toLocaleString('fr-FR'),
    },
    {
      key: 'building',
      header: 'Bâtiment',
      render: (b) => (buildingsError ? '—' : (buildingsById.get(b.buildingId) ?? '—')),
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
      emptyLabel="Aucune bande pour le moment."
    />
  );
}
