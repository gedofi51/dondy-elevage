'use client';

import { useForm, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Item } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SupplierSelect } from '@/components/shared/entity-select';
import { useItems, useCreateItem, useUpdateItem } from '../hooks';
import {
  createItemSchema,
  updateItemSchema,
  ITEM_CANONICAL_CATEGORIES,
  type CreateItemFormInput,
  type CreateItemFormValues,
  type UpdateItemFormInput,
  type UpdateItemFormValues,
} from '../schemas';

/** <datalist> HTML native — suggère les 8 catégories canoniques
 * (docs/reference/STOCKS.md) + celles déjà observées en base, tout en
 * laissant le champ texte libre (l'API n'impose aucun enum). Ferme le
 * risque de dérive de casse trouvé entre le code existant et les
 * fixtures e2e backend (voir DETTE_TECHNIQUE.md Phase 14). */
function CategoryField<T extends FieldValues & { category?: string }>({
  register,
  error,
}: {
  register: UseFormRegister<T>;
  error?: string;
}) {
  const { data: items } = useItems();
  const observedCategories = [...new Set((items ?? []).map((i) => i.category))];
  const categories = [...new Set([...ITEM_CANONICAL_CATEGORIES, ...observedCategories])];

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="item-category">Catégorie</Label>
      <Input id="item-category" list="item-categories" {...register('category' as Path<T>)} />
      <datalist id="item-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function ItemForm({ item }: { item?: Item }) {
  return item ? <EditItemForm item={item} /> : <CreateItemForm />;
}

function CreateItemForm() {
  const router = useRouter();
  const createMutation = useCreateItem();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateItemFormInput, unknown, CreateItemFormValues>({
    resolver: zodResolver(createItemSchema),
    defaultValues: { supplierId: '' },
  });

  async function onSubmit(values: CreateItemFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        supplierId: values.supplierId || undefined,
      });
      toast.success('Article créé.');
      router.push(`/stocks/${created.id}`);
    } catch {
      toast.error('Échec de la création — vérifiez les champs.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="item-name">Nom</Label>
        <Input id="item-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <CategoryField register={register} error={errors.category?.message} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="item-unit">Unité</Label>
          <Input id="item-unit" placeholder="kg, L, unité…" {...register('unit')} />
          {errors.unit ? <p className="text-sm text-destructive">{errors.unit.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="item-threshold">Seuil minimum</Label>
          <Input id="item-threshold" type="number" step="0.001" {...register('minThreshold')} />
        </div>
      </div>

      <SupplierSelect name="supplierId" control={control} error={errors.supplierId?.message} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer l’article'}
      </Button>
    </form>
  );
}

function EditItemForm({ item }: { item: Item }) {
  const router = useRouter();
  const updateMutation = useUpdateItem(item.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateItemFormInput, unknown, UpdateItemFormValues>({
    resolver: zodResolver(updateItemSchema),
    defaultValues: {
      name: item.name,
      category: item.category,
      unit: item.unit,
      minThreshold: item.minThreshold ? Number(item.minThreshold) : undefined,
      supplierId: item.supplierId ?? '',
    },
  });

  async function onSubmit(values: UpdateItemFormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        supplierId: values.supplierId || undefined,
      });
      toast.success('Article modifié.');
      router.push(`/stocks/${item.id}`);
    } catch {
      toast.error('Échec de l’enregistrement — vérifiez les champs.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="item-name">Nom</Label>
        <Input id="item-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <CategoryField register={register} error={errors.category?.message} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="item-unit">Unité</Label>
          <Input id="item-unit" {...register('unit')} />
          {errors.unit ? <p className="text-sm text-destructive">{errors.unit.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="item-threshold">Seuil minimum</Label>
          <Input id="item-threshold" type="number" step="0.001" {...register('minThreshold')} />
        </div>
      </div>

      <SupplierSelect name="supplierId" control={control} error={errors.supplierId?.message} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
