'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { CreateSupplierPaymentInput } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreateSupplierPayment } from '../hooks';
import {
  createSupplierPaymentSchema,
  type CreateSupplierPaymentFormInput,
  type CreateSupplierPaymentFormValues,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `balanceFcfa` déjà exposé par GET /purchase-orders/:id (jamais
 * recalculé côté client) — affiché en aide, avertissement client si
 * dépassement (pas un blocage dur : le 409 serveur exact, "Paiement (X
 * FCFA) supérieur au solde restant (Y FCFA).", reste la source de
 * vérité via extractMessage, même patron que le formulaire d'orientation
 * Phase 13). */
export function SupplierPaymentForm({
  purchaseOrderId,
  balanceFcfa,
  onSuccess,
}: {
  purchaseOrderId: string;
  balanceFcfa: number;
  onSuccess?: () => void;
}) {
  const createMutation = useCreateSupplierPayment(purchaseOrderId);
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateSupplierPaymentFormInput, unknown, CreateSupplierPaymentFormValues>({
    resolver: zodResolver(createSupplierPaymentSchema),
    defaultValues: { date: todayIsoDate() },
  });
  const amountFcfa = Number(watch('amountFcfa')) || 0;
  const exceedsBalance = amountFcfa > balanceFcfa;

  async function onSubmit(values: CreateSupplierPaymentFormValues) {
    try {
      const input: CreateSupplierPaymentInput = {
        purchaseOrderId,
        ...values,
        reference: values.reference || undefined,
        observation: values.observation || undefined,
      };
      await createMutation.mutateAsync(input);
      toast.success('Paiement enregistré.');
      onSuccess?.();
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
      <p className="text-sm text-muted-foreground">
        Solde restant : {balanceFcfa.toLocaleString('fr-FR')} FCFA.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sp-date">Date</Label>
          <Input id="sp-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sp-method">Mode de paiement</Label>
          <Input id="sp-method" placeholder="Espèces, Mobile Money, Virement…" {...register('method')} />
          {errors.method ? <p className="text-sm text-destructive">{errors.method.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sp-amount">Montant (FCFA)</Label>
        <Input id="sp-amount" type="number" {...register('amountFcfa')} />
        {errors.amountFcfa ? <p className="text-sm text-destructive">{errors.amountFcfa.message}</p> : null}
        {exceedsBalance ? (
          <p className="text-sm text-warning">
            Montant supérieur au solde restant ({balanceFcfa.toLocaleString('fr-FR')} FCFA) —
            l’enregistrement sera refusé par le serveur.
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sp-reference">Référence</Label>
        <Input id="sp-reference" {...register('reference')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sp-observation">Observation</Label>
        <Textarea id="sp-observation" {...register('observation')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer le paiement'}
      </Button>
    </form>
  );
}
