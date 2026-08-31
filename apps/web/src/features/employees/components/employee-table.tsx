'use client';

import Link from 'next/link';
import type { Employee } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useBuildings } from '@/features/buildings/hooks';
import { employeeStatusLabels } from '../schemas';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const employeeStatusConfig: Record<Employee['status'], { label: string; tone: Tone }> = {
  ACTIF: { label: employeeStatusLabels.ACTIF, tone: 'success' },
  CONGE: { label: employeeStatusLabels.CONGE, tone: 'info' },
  SUSPENDU: { label: employeeStatusLabels.SUSPENDU, tone: 'warning' },
  DEPART: { label: employeeStatusLabels.DEPART, tone: 'muted' },
};

interface EmployeeTableProps {
  data: Employee[] | undefined;
  isLoading: boolean;
}

/** Pas de colonne salaire — §3 du cadrage ne prévoit ce champ que sur la
 * fiche détaillée, pas la liste ; cohérent avec la donnée sensible
 * masquée pour certains rôles (voir DETTE_TECHNIQUE.md). */
export function EmployeeTable({ data, isLoading }: EmployeeTableProps) {
  const { data: buildings, isError: buildingsError } = useBuildings();
  const buildingsById = new Map((buildings ?? []).map((b) => [b.id, b.name]));

  const columns: DataTableColumn<Employee>[] = [
    {
      key: 'code',
      header: 'Matricule',
      render: (e) => (
        <Link href={`/personnel/${e.id}`} className="font-medium text-primary hover:underline">
          {e.code}
        </Link>
      ),
    },
    { key: 'name', header: 'Nom', render: (e) => e.name },
    { key: 'position', header: 'Poste', render: (e) => e.position },
    {
      key: 'building',
      header: 'Bâtiment',
      render: (e) => {
        if (!e.buildingId) return '—';
        return buildingsError ? '—' : (buildingsById.get(e.buildingId) ?? '—');
      },
    },
    {
      key: 'status',
      header: 'Statut',
      render: (e) => (
        <StatusBadge label={employeeStatusConfig[e.status].label} tone={employeeStatusConfig[e.status].tone} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(e) => e.id}
      emptyLabel="Aucun employé pour le moment."
    />
  );
}
