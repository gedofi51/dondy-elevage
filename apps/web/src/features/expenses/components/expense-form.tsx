'use client';

import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { CreateExpenseInput, Expense, UpdateExpenseInput } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierSelect } from '@/components/shared/entity-select';
import { useBroilerBatches } from '@/features/broiler-batches/hooks';
import { useLayerBatches } from '@/features/layer-batches/hooks';
import { useChickBatches } from '@/features/chick-batches/hooks';
import { useBreederBatches } from '@/features/breeder-batches/hooks';
import { useIncubationBatches } from '@/features/incubation-batches/hooks';
import { useWaterPoints } from '@/features/water-points/hooks';
import { useCreateExpense, useUpdateExpense } from '../hooks';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseEntityTypeOptions,
  type CreateExpenseFormInput,
  type CreateExpenseFormValues,
  type UpdateExpenseFormInput,
  type UpdateExpenseFormValues,
  type ExpenseEntityType,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const entityTypeLabels: Record<ExpenseEntityType, string> = {
  AUCUN: 'Aucun (dépense générale)',
  CHAIR: 'Bande de chair',
  PONDEUSES: 'Lot de pondeuses',
  POUSSINS: 'Lot de poussins',
  REPRODUCTEURS: 'Lot reproducteur',
  COUVOIR: "Lot d'incubation",
  EAU: "Point d'eau",
};

/** Composant local, à usage unique dans ce formulaire (voir plan Phase 14,
 * section F) — 6 hooks déjà existants, chacun `enabled` uniquement pour le
 * type actuellement sélectionné (pas 6 requêtes systématiques). `options`
 * déjà résolues par l'appelant plutôt que 6 composants typés dans
 * entity-select.tsx (aucun des 6 n'a de second point d'usage ailleurs). */
function EntityRefSelect<T extends FieldValues>({
  name,
  control,
  options,
}: {
  name: Path<T>;
  control: Control<T>;
  options: { value: string; label: string }[];
}) {
  const optionsById = new Map(options.map((o) => [o.value, o.label]));
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select value={field.value ?? ''} onValueChange={field.onChange}>
          <SelectTrigger id={name}>
            <SelectValue placeholder="Sélectionner…">
              {(value: string) => (value ? (optionsById.get(value) ?? value) : 'Sélectionner…')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

function entityFkKey(entityType: ExpenseEntityType): keyof CreateExpenseInput | null {
  switch (entityType) {
    case 'CHAIR':
      return 'batchId';
    case 'PONDEUSES':
      return 'layerBatchId';
    case 'POUSSINS':
      return 'chickBatchId';
    case 'REPRODUCTEURS':
      return 'breederBatchId';
    case 'COUVOIR':
      return 'incubationBatchId';
    case 'EAU':
      return 'waterPointId';
    case 'AUCUN':
      return null;
  }
}

function expenseToEntityType(expense: Expense): ExpenseEntityType {
  if (expense.batchId) return 'CHAIR';
  if (expense.layerBatchId) return 'PONDEUSES';
  if (expense.chickBatchId) return 'POUSSINS';
  if (expense.breederBatchId) return 'REPRODUCTEURS';
  if (expense.incubationBatchId) return 'COUVOIR';
  if (expense.waterPointId) return 'EAU';
  return 'AUCUN';
}

function entityIdOf(expense: Expense): string {
  return (
    expense.batchId ??
    expense.layerBatchId ??
    expense.chickBatchId ??
    expense.breederBatchId ??
    expense.incubationBatchId ??
    expense.waterPointId ??
    ''
  );
}

export function ExpenseForm({ expense }: { expense?: Expense }) {
  return expense ? <EditExpenseForm expense={expense} /> : <CreateExpenseForm />;
}

function useEntityOptions(entityType: ExpenseEntityType) {
  const { data: broilerBatches } = useBroilerBatches({ enabled: entityType === 'CHAIR' });
  const { data: layerBatches } = useLayerBatches({ enabled: entityType === 'PONDEUSES' });
  const { data: chickBatches } = useChickBatches({ enabled: entityType === 'POUSSINS' });
  const { data: breederBatches } = useBreederBatches({ enabled: entityType === 'REPRODUCTEURS' });
  const { data: incubationBatches } = useIncubationBatches({ enabled: entityType === 'COUVOIR' });
  const { data: waterPoints } = useWaterPoints({ enabled: entityType === 'EAU' });

  switch (entityType) {
    case 'CHAIR':
      return (broilerBatches ?? []).map((b) => ({ value: b.id, label: b.code }));
    case 'PONDEUSES':
      return (layerBatches ?? []).map((b) => ({ value: b.id, label: b.code }));
    case 'POUSSINS':
      return (chickBatches ?? []).map((b) => ({ value: b.id, label: b.code }));
    case 'REPRODUCTEURS':
      return (breederBatches ?? []).map((b) => ({ value: b.id, label: b.code }));
    case 'COUVOIR':
      return (incubationBatches ?? []).map((b) => ({ value: b.id, label: b.code }));
    case 'EAU':
      return (waterPoints ?? []).map((w) => ({ value: w.id, label: w.code }));
    case 'AUCUN':
      return [];
  }
}

function CreateExpenseForm() {
  const router = useRouter();
  const createMutation = useCreateExpense();
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseFormInput, unknown, CreateExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { date: todayIsoDate(), entityType: 'AUCUN', entityId: '', supplierId: '' },
  });
  const entityType = watch('entityType');
  const entityOptions = useEntityOptions(entityType);

  async function onSubmit(values: CreateExpenseFormValues) {
    try {
      const fkKey = entityFkKey(values.entityType);
      const input: CreateExpenseInput = {
        date: values.date,
        category: values.category,
        description: values.description || undefined,
        quantity: values.quantity,
        unitPriceFcfa: values.unitPriceFcfa,
        amountFcfa: values.amountFcfa,
        supplierId: values.supplierId || undefined,
        ...(fkKey && values.entityId ? { [fkKey]: values.entityId } : {}),
      };
      await createMutation.mutateAsync(input);
      toast.success('Dépense créée.');
      router.push('/depenses');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création — vérifiez les champs.')
          : 'Échec de la création — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="exp-date">Date</Label>
          <Input id="exp-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-category">Catégorie</Label>
          <Input id="exp-category" {...register('category')} />
          {errors.category ? <p className="text-sm text-destructive">{errors.category.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="exp-description">Description</Label>
        <Textarea id="exp-description" {...register('description')} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="exp-quantity">Quantité</Label>
          <Input id="exp-quantity" type="number" step="0.01" {...register('quantity')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-unit-price">Prix unitaire (FCFA)</Label>
          <Input id="exp-unit-price" type="number" {...register('unitPriceFcfa')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-amount">Montant total (FCFA)</Label>
          <Input id="exp-amount" type="number" {...register('amountFcfa')} />
          {errors.amountFcfa ? <p className="text-sm text-destructive">{errors.amountFcfa.message}</p> : null}
        </div>
      </div>

      <SupplierSelect name="supplierId" control={control} error={errors.supplierId?.message} />

      <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <h2 className="font-heading text-sm font-semibold text-primary">Rattachement (optionnel)</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-entity-type">Type</Label>
          <Controller
            name="entityType"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="exp-entity-type">
                  <SelectValue>{(value: ExpenseEntityType) => entityTypeLabels[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {expenseEntityTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {entityTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        {entityType !== 'AUCUN' ? (
          <div className="grid gap-1.5">
            <Label htmlFor="entityId">{entityTypeLabels[entityType]}</Label>
            <EntityRefSelect name="entityId" control={control} options={entityOptions} />
          </div>
        ) : null}
      </section>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer la dépense'}
      </Button>
    </form>
  );
}

function EditExpenseForm({ expense }: { expense: Expense }) {
  const router = useRouter();
  const updateMutation = useUpdateExpense(expense.id);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateExpenseFormInput, unknown, UpdateExpenseFormValues>({
    resolver: zodResolver(updateExpenseSchema),
    defaultValues: {
      date: expense.date.slice(0, 10),
      category: expense.category,
      description: expense.description ?? '',
      quantity: expense.quantity ? Number(expense.quantity) : undefined,
      unitPriceFcfa: expense.unitPriceFcfa ?? undefined,
      amountFcfa: expense.amountFcfa,
      supplierId: expense.supplierId ?? '',
      entityType: expenseToEntityType(expense),
      entityId: entityIdOf(expense),
    },
  });
  const entityType = watch('entityType');
  const entityOptions = useEntityOptions(entityType);

  async function onSubmit(values: UpdateExpenseFormValues) {
    try {
      const fkKey = entityFkKey(values.entityType);
      const input: UpdateExpenseInput = {
        date: values.date,
        category: values.category,
        description: values.description || undefined,
        quantity: values.quantity,
        unitPriceFcfa: values.unitPriceFcfa,
        amountFcfa: values.amountFcfa,
        supplierId: values.supplierId || undefined,
        ...(fkKey && values.entityId ? { [fkKey]: values.entityId } : {}),
      };
      await updateMutation.mutateAsync(input);
      toast.success('Dépense modifiée.');
      router.push('/depenses');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement — vérifiez les champs.')
          : 'Échec de l’enregistrement — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="exp-date">Date</Label>
          <Input id="exp-date" type="date" {...register('date')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-category">Catégorie</Label>
          <Input id="exp-category" {...register('category')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="exp-description">Description</Label>
        <Textarea id="exp-description" {...register('description')} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="exp-quantity">Quantité</Label>
          <Input id="exp-quantity" type="number" step="0.01" {...register('quantity')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-unit-price">Prix unitaire (FCFA)</Label>
          <Input id="exp-unit-price" type="number" {...register('unitPriceFcfa')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-amount">Montant total (FCFA)</Label>
          <Input id="exp-amount" type="number" {...register('amountFcfa')} />
        </div>
      </div>

      <SupplierSelect name="supplierId" control={control} error={errors.supplierId?.message} />

      <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <h2 className="font-heading text-sm font-semibold text-primary">Rattachement (optionnel)</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-entity-type">Type</Label>
          <Controller
            name="entityType"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="exp-entity-type">
                  <SelectValue>{(value: ExpenseEntityType) => entityTypeLabels[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {expenseEntityTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {entityTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        {entityType !== 'AUCUN' ? (
          <div className="grid gap-1.5">
            <Label htmlFor="entityId">{entityTypeLabels[entityType]}</Label>
            <EntityRefSelect name="entityId" control={control} options={entityOptions} />
          </div>
        ) : null}
      </section>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
