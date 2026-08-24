import { EditExpenseView } from './edit-expense-view';

export default async function EditExpensePage(props: PageProps<'/depenses/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditExpenseView expenseId={id} />;
}
