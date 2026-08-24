import { PageHeader } from '@/components/shared/page-header';
import { ItemForm } from '@/features/items/components/item-form';

export default function NewItemPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvel article" />
      <div className="max-w-2xl">
        <ItemForm />
      </div>
    </div>
  );
}
