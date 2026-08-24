import { PageHeader } from '@/components/shared/page-header';
import { ExpenseForm } from '@/features/expenses/components/expense-form';

export default function NewExpensePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvelle dépense" />
      <div className="max-w-2xl">
        <ExpenseForm />
      </div>
    </div>
  );
}
