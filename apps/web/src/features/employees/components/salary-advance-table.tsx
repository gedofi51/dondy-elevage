'use client';

import type { SalaryAdvance } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

interface SalaryAdvanceTableProps {
  data: SalaryAdvance[] | undefined;
  isLoading: boolean;
  /** Période du relevé qui a déduit chaque avance, pour affichage —
   * construite par le parent à partir des relevés déjà chargés (aucune
   * requête supplémentaire). */
  payrollPeriodById: Map<string, string>;
}

/** Pas de colonne « solde » agrégé — aucun endpoint ne l'expose (voir
 * shared-types/salary-advances.ts) ; seul le statut par avance
 * (déduite/en attente) est reflété tel quel, jamais une somme
 * recalculée côté front (interdiction explicite du Lot 6d). */
export function SalaryAdvanceTable({ data, isLoading, payrollPeriodById }: SalaryAdvanceTableProps) {
  const columns: DataTableColumn<SalaryAdvance>[] = [
    { key: 'date', header: 'Date', render: (a) => new Date(a.date).toLocaleDateString('fr-FR') },
    { key: 'amount', header: 'Montant', render: (a) => `${a.amountFcfa.toLocaleString('fr-FR')} FCFA` },
    {
      key: 'status',
      header: 'Statut',
      render: (a) =>
        a.deductedInPayrollId ? (
          <StatusBadge
            label={`Déduite (${payrollPeriodById.get(a.deductedInPayrollId) ?? 'relevé lié'})`}
            tone="muted"
          />
        ) : (
          <StatusBadge label="En attente" tone="warning" />
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(a) => a.id}
      emptyLabel="Aucune avance sur salaire."
    />
  );
}
