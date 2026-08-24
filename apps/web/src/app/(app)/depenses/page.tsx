'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { Expense } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteExpense, useExpenses } from '@/features/expenses/hooks';
import { ExpenseTable } from '@/features/expenses/components/expense-table';

export default function ExpensesListPage() {
  const { data, isLoading } = useExpenses();
  const deleteMutation = useDeleteExpense();
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  async function handleConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      toast.success('Dépense supprimée.');
    } catch {
      toast.error('Échec de la suppression.');
    } finally {
      setToDelete(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dépenses"
        description="Dépenses générales et rattachées aux modules métier."
        action={
          <Can permission={PERMISSIONS.EXPENSES_CREATE}>
            <Button nativeButton={false} render={<Link href="/depenses/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvelle dépense
            </Button>
          </Can>
        }
      />

      <ExpenseTable
        data={data}
        isLoading={isLoading}
        rowActions={(expense) => (
          <Can permission={PERMISSIONS.EXPENSES_DELETE}>
            <Button variant="outline" size="icon" onClick={() => setToDelete(expense)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Can>
        )}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer cette dépense ?"
        description={toDelete ? `${toDelete.amountFcfa.toLocaleString('fr-FR')} FCFA (${toDelete.category}) seront définitivement supprimés.` : undefined}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
