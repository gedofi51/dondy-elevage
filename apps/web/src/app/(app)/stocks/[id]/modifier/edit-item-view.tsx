'use client';

import { PageHeader } from '@/components/shared/page-header';
import { ItemForm } from '@/features/items/components/item-form';
import { useItem } from '@/features/items/hooks';

export function EditItemView({ itemId }: { itemId: string }) {
  const { data: item, isLoading } = useItem(itemId);

  if (isLoading || !item) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${item.name}`} />
      <div className="max-w-2xl">
        <ItemForm item={item} />
      </div>
    </div>
  );
}
