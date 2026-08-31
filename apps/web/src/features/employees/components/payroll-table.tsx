'use client';

import type { ReactNode } from 'react';
import type { Payroll, PayrollStatus } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { payrollStatusLabels } from '../schemas';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const payrollStatusConfig: Record<PayrollStatus, { label: string; tone: Tone }> = {
  BROUILLON: { label: payrollStatusLabels.BROUILLON, tone: 'warning' },
  VALIDE: { label: payrollStatusLabels.VALIDE, tone: 'success' },
};

interface PayrollTableProps {
  data: Payroll[] | undefined;
  isLoading: boolean;
  rowActions?: (payroll: Payroll) => ReactNode;
}

/** Colonnes volontairement minimales (période/net/statut) — suivi
 * indicatif, pas un bulletin détaillé (voir MODULE_PERSONNEL.md) ; le
 * détail base/prime/retenues reste visible dans le formulaire de
 * correction. */
export function PayrollTable({ data, isLoading, rowActions }: PayrollTableProps) {
  const columns: DataTableColumn<Payroll>[] = [
    {
      key: 'period',
      header: 'Période',
      render: (p) =>
        `${new Date(p.periodStart).toLocaleDateString('fr-FR')} – ${new Date(p.periodEnd).toLocaleDateString('fr-FR')}`,
    },
    { key: 'net', header: 'Net à payer', render: (p) => `${p.netFcfa.toLocaleString('fr-FR')} FCFA` },
    {
      key: 'status',
      header: 'Statut',
      render: (p) => (
        <StatusBadge label={payrollStatusConfig[p.status].label} tone={payrollStatusConfig[p.status].tone} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(p) => p.id}
      emptyLabel="Aucun relevé de paie."
      rowActions={rowActions}
    />
  );
}
