'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CreateGoodsReceiptInput, PurchaseOrderWithComputed } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserSelect } from '@/components/shared/entity-select';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useItems } from '@/features/items/hooks';
import { useCreateGoodsReceipt } from '../hooks';
import { computeRemainingToReceive } from '../receipt-remaining';
import {
  createGoodsReceiptSchema,
  type CreateGoodsReceiptFormInput,
  type CreateGoodsReceiptFormValues,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Tableau STATIQUE — nombre de lignes fixe (une par ligne de la
 * commande), pas de useFieldArray (voir plan Phase 14, section C.3).
 * Les lignes laissées à 0 sont filtrées avant soumission : le serveur
 * rejette une receivedQuantity=0 (@Min(0.001)). */
export function GoodsReceiptForm({ order }: { order: PurchaseOrderWithComputed }) {
  const router = useRouter();
  const { data: items } = useItems();
  const itemNamesById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const createMutation = useCreateGoodsReceipt(order.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGoodsReceiptFormInput, unknown, CreateGoodsReceiptFormValues>({
    resolver: zodResolver(createGoodsReceiptSchema),
    defaultValues: {
      date: todayIsoDate(),
      responsibleId: '',
      items: order.items.map((line) => ({ purchaseOrderItemId: line.id, receivedQuantity: 0 })),
    },
  });

  async function onSubmit(values: CreateGoodsReceiptFormValues) {
    const nonZeroLines = values.items.filter((line) => line.receivedQuantity > 0);
    if (nonZeroLines.length === 0) {
      toast.error('Saisissez une quantité reçue pour au moins une ligne.');
      return;
    }
    try {
      const input: CreateGoodsReceiptInput = {
        date: values.date,
        responsibleId: values.responsibleId || undefined,
        observation: values.observation || undefined,
        items: nonZeroLines,
      };
      await createMutation.mutateAsync(input);
      toast.success('Réception enregistrée.');
      router.push(`/achats/${order.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement — vérifiez les champs.')
          : 'Échec de l’enregistrement — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="gr-date">Date</Label>
          <Input id="gr-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <UserSelect name="responsibleId" label="Responsable (optionnel)" control={control} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Lignes reçues</h2>
        {order.items.map((line, index) => {
          const remaining = computeRemainingToReceive(Number(line.orderedQuantity), line.receivedQuantity);
          return (
            <div key={line.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{itemNamesById.get(line.itemId) ?? line.itemId}</p>
              <p className="text-sm text-muted-foreground">
                Déjà reçu : {line.receivedQuantity.toLocaleString('fr-FR')} / {Number(line.orderedQuantity).toLocaleString('fr-FR')}{' '}
                — restant : {remaining.toLocaleString('fr-FR')}
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor={`gr-qty-${index}`}>Quantité reçue cette fois</Label>
                <Input
                  id={`gr-qty-${index}`}
                  type="number"
                  step="0.001"
                  {...register(`items.${index}.receivedQuantity`)}
                />
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-1.5">
        <Label htmlFor="gr-observation">Observation</Label>
        <Textarea id="gr-observation" {...register('observation')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer la réception'}
      </Button>
    </form>
  );
}
