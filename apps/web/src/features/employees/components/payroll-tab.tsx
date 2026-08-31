'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { PERMISSIONS, type Payroll } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useEmployeePayroll, useSalaryAdvances, useUpdatePayroll } from '../hooks';
import { PayrollTable } from './payroll-table';
import { PayrollDialog } from './payroll-dialog';
import { SalaryAdvanceTable } from './salary-advance-table';
import { SalaryAdvanceDialog } from './salary-advance-dialog';

const OPEN_PAYROLL_STATUSES = new Set(['BROUILLON']);

/**
 * Contenu réel de l'onglet Paie (Lot 6d) — composant à part entière
 * (pas inliné dans EmployeeDetailView, contrairement à Présence/Tâches)
 * précisément pour que ses hooks (useEmployeePayroll/useSalaryAdvances)
 * ne soient JAMAIS appelés pour un rôle sans PAYROLL_READ : ce composant
 * n'est monté que comme enfant de `<Can permission={PAYROLL_READ}>`
 * (voir employee-detail-view.tsx) — Lecteur ne déclenche donc aucune
 * requête, aucune entrée de cache React Query, aucun rendu DOM pour
 * cette ressource. Voir DETTE_TECHNIQUE.md Lot 6d, « Rappel critique ».
 */
export function PayrollTab({ employeeId }: { employeeId: string }) {
  const { data: payrolls, isLoading: payrollsLoading } = useEmployeePayroll(employeeId);
  const { data: advances, isLoading: advancesLoading } = useSalaryAdvances(employeeId);

  const [payrollDialogState, setPayrollDialogState] = useState<{ open: boolean; payroll?: Payroll }>({
    open: false,
  });
  const [validateTargetId, setValidateTargetId] = useState<string | null>(null);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);

  const validateMutation = useUpdatePayroll(employeeId, validateTargetId ?? '');

  const payrollPeriodById = useMemo(
    () =>
      new Map(
        (payrolls ?? []).map((p) => [
          p.id,
          `${new Date(p.periodStart).toLocaleDateString('fr-FR')} – ${new Date(p.periodEnd).toLocaleDateString('fr-FR')}`,
        ]),
      ),
    [payrolls],
  );

  async function handleValidate() {
    try {
      await validateMutation.mutateAsync({ status: 'VALIDE' });
      toast.success('Relevé validé.');
      setValidateTargetId(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la validation.')
          : 'Échec de la validation.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold text-primary">Relevés de paie</h3>
          <Can permission={PERMISSIONS.PAYROLL_CREATE}>
            <Button size="sm" variant="outline" onClick={() => setPayrollDialogState({ open: true })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau relevé
            </Button>
          </Can>
        </div>
        <PayrollTable
          data={payrolls}
          isLoading={payrollsLoading}
          rowActions={(payroll) =>
            OPEN_PAYROLL_STATUSES.has(payroll.status) ? (
              <div className="flex justify-end gap-2">
                <Can permission={PERMISSIONS.PAYROLL_UPDATE}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPayrollDialogState({ open: true, payroll })}
                  >
                    Modifier
                  </Button>
                </Can>
                <Can permission={PERMISSIONS.PAYROLL_UPDATE}>
                  <Button size="sm" variant="outline" onClick={() => setValidateTargetId(payroll.id)}>
                    Valider
                  </Button>
                </Can>
              </div>
            ) : null
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold text-primary">Avances sur salaire</h3>
          <Can permission={PERMISSIONS.SALARY_ADVANCES_CREATE}>
            <Button size="sm" variant="outline" onClick={() => setAdvanceDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvelle avance
            </Button>
          </Can>
        </div>
        <SalaryAdvanceTable data={advances} isLoading={advancesLoading} payrollPeriodById={payrollPeriodById} />
      </section>

      <PayrollDialog
        open={payrollDialogState.open}
        onOpenChange={(open) => setPayrollDialogState({ open })}
        employeeId={employeeId}
        payroll={payrollDialogState.payroll}
      />
      <ConfirmDialog
        open={!!validateTargetId}
        onOpenChange={(open) => !open && setValidateTargetId(null)}
        onConfirm={handleValidate}
        title="Valider ce relevé de paie ?"
        description="Statut terminal — plus aucune modification ni annulation ne sera possible après validation."
        confirmLabel="Valider"
        destructive={false}
      />
      <SalaryAdvanceDialog
        employeeId={employeeId}
        open={advanceDialogOpen}
        onOpenChange={setAdvanceDialogOpen}
      />
    </div>
  );
}
