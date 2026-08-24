'use client';

import { PageHeader } from '@/components/shared/page-header';
import { ExpenseForm } from '@/features/expenses/components/expense-form';
import { useExpense } from '@/features/expenses/hooks';

export function EditExpenseView({ expenseId }: { expenseId: string }) {
  const { data: expense, isLoading } = useExpense(expenseId);

  if (isLoading || !expense) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Modifier la dépense" />
      <div className="max-w-2xl">
        <ExpenseForm expense={expense} />
      </div>
    </div>
  );
}
