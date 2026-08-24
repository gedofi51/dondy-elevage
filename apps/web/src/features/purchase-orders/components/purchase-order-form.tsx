'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { CreatePurchaseOrderInput } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SupplierSelect, ItemSelect } from '@/components/shared/entity-select';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreatePurchaseOrder } from '../hooks';
import { computeLineAmountFcfa, computeOrderTotalFcfa } from '../line-totals';
import {
  createPurchaseOrderSchema,
  type CreatePurchaseOrderFormInput,
  type CreatePurchaseOrderFormValues,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseOrderForm() {
  const router = useRouter();
  const createMutation = useCreatePurchaseOrder();
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePurchaseOrderFormInput, unknown, CreatePurchaseOrderFormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    // supplierId initialisé à '' : Select contrôlé dès le premier rendu
    // (voir DETTE_TECHNIQUE.md Phase 12). Une ligne vide au départ —
    // l'utilisateur en ajoute d'autres au besoin.
    defaultValues: {
      date: todayIsoDate(),
      supplierId: '',
      items: [{ itemId: '', orderedQuantity: 1, unitPriceFcfa: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  async function onSubmit(values: CreatePurchaseOrderFormValues) {
    try {
      const input: CreatePurchaseOrderInput = {
        ...values,
        dueDate: values.dueDate || undefined,
        observation: values.observation || undefined,
      };
      const created = await createMutation.mutateAsync(input);
      toast.success('Commande créée.');
      router.push(`/achats/${created.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création — vérifiez les champs.')
          : 'Échec de la création — vérifiez les champs.',
      );
    }
  }

  const total = computeOrderTotalFcfa(
    (watchedItems ?? []).map((line) => ({
      orderedQuantity: Number(line?.orderedQuantity) || 0,
      unitPriceFcfa: Number(line?.unitPriceFcfa) || 0,
    })),
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <SupplierSelect name="supplierId" control={control} error={errors.supplierId?.message} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="po-date">Date</Label>
          <Input id="po-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="po-due-date">Échéance de paiement</Label>
          <Input id="po-due-date" type="date" {...register('dueDate')} />
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-primary">Lignes</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ itemId: '', orderedQuantity: 1, unitPriceFcfa: 0 })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter une ligne
          </Button>
        </div>
        {errors.items?.message ? <p className="text-sm text-destructive">{errors.items.message}</p> : null}

        {fields.map((field, index) => {
          const line = watchedItems?.[index];
          const lineAmount = computeLineAmountFcfa(
            Number(line?.orderedQuantity) || 0,
            Number(line?.unitPriceFcfa) || 0,
          );
          return (
            <div key={field.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <ItemSelect
                    name={`items.${index}.itemId`}
                    control={control}
                    error={errors.items?.[index]?.itemId?.message}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor={`po-qty-${index}`}>Quantité</Label>
                  <Input
                    id={`po-qty-${index}`}
                    type="number"
                    step="0.001"
                    {...register(`items.${index}.orderedQuantity`)}
                  />
                  {errors.items?.[index]?.orderedQuantity ? (
                    <p className="text-sm text-destructive">
                      {errors.items[index]?.orderedQuantity?.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`po-price-${index}`}>Prix unitaire (FCFA)</Label>
                  <Input
                    id={`po-price-${index}`}
                    type="number"
                    {...register(`items.${index}.unitPriceFcfa`)}
                  />
                  {errors.items?.[index]?.unitPriceFcfa ? (
                    <p className="text-sm text-destructive">
                      {errors.items[index]?.unitPriceFcfa?.message}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Montant de la ligne (informatif) : {lineAmount.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          );
        })}

        <p className="text-right text-sm font-medium text-foreground">
          Total (informatif) : {total.toLocaleString('fr-FR')} FCFA
        </p>
      </section>

      <div className="grid gap-1.5">
        <Label htmlFor="po-observation">Observation</Label>
        <Textarea id="po-observation" {...register('observation')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer la commande'}
      </Button>
    </form>
  );
}
