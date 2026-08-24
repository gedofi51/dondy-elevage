'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { CreateStockMovementInput } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreateStockMovement } from '../hooks';
import { getStockMovementTypeForReason } from '../reason-type';
import {
  createStockMovementSchema,
  manualStockMovementReasonOptions,
  type CreateStockMovementFormInput,
  type CreateStockMovementFormValues,
} from '../schemas';

const reasonLabels: Record<(typeof manualStockMovementReasonOptions)[number], string> = {
  RETOUR: 'Retour',
  AJUSTEMENT: 'Ajustement (inventaire)',
  PRODUCTION_INTERNE: 'Production interne',
  VENTE: 'Vente',
  PERTE: 'Perte',
  CASSE: 'Casse',
  CONSOMMATION_INTERNE: 'Consommation interne',
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StockMovementForm({ itemId, onSuccess }: { itemId: string; onSuccess?: () => void }) {
  const createMutation = useCreateStockMovement();
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateStockMovementFormInput, unknown, CreateStockMovementFormValues>({
    resolver: zodResolver(createStockMovementSchema),
    defaultValues: { date: todayIsoDate(), reason: 'AJUSTEMENT', type: 'ENTREE' },
  });
  const reason = watch('reason');
  const typeChoice = getStockMovementTypeForReason(reason);

  async function onSubmit(values: CreateStockMovementFormValues) {
    try {
      const input: CreateStockMovementInput = {
        itemId,
        type: values.type,
        reason: values.reason,
        quantity: values.quantity,
        date: values.date,
        unitCostFcfa: values.reason === 'PRODUCTION_INTERNE' ? values.unitCostFcfa : undefined,
        justification: values.reason === 'AJUSTEMENT' ? values.justification || undefined : undefined,
      };
      await createMutation.mutateAsync(input);
      toast.success('Mouvement enregistré.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="sm-reason">Motif</Label>
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                const mapped = getStockMovementTypeForReason(
                  value as (typeof manualStockMovementReasonOptions)[number],
                );
                if (mapped !== 'CHOICE') setValue('type', mapped);
              }}
            >
              <SelectTrigger id="sm-reason">
                <SelectValue>
                  {(value: (typeof manualStockMovementReasonOptions)[number]) => reasonLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {manualStockMovementReasonOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {reasonLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {typeChoice === 'CHOICE' ? (
        <div className="grid gap-1.5">
          <Label htmlFor="sm-type">Sens du mouvement</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="sm-type">
                  <SelectValue>{(value: 'ENTREE' | 'SORTIE') => (value === 'ENTREE' ? 'Entrée' : 'Sortie')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTREE">Entrée</SelectItem>
                  <SelectItem value="SORTIE">Sortie</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sm-quantity">Quantité</Label>
          <Input id="sm-quantity" type="number" step="0.001" {...register('quantity')} />
          {errors.quantity ? <p className="text-sm text-destructive">{errors.quantity.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sm-date">Date</Label>
          <Input id="sm-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
      </div>

      {reason === 'PRODUCTION_INTERNE' ? (
        <div className="grid gap-1.5">
          <Label htmlFor="sm-unit-cost">Coût unitaire (FCFA)</Label>
          <Input id="sm-unit-cost" type="number" {...register('unitCostFcfa')} />
          {errors.unitCostFcfa ? (
            <p className="text-sm text-destructive">{errors.unitCostFcfa.message}</p>
          ) : null}
        </div>
      ) : null}

      {reason === 'AJUSTEMENT' ? (
        <div className="grid gap-1.5">
          <Label htmlFor="sm-justification">Justification</Label>
          <Textarea id="sm-justification" {...register('justification')} />
          {errors.justification ? (
            <p className="text-sm text-destructive">{errors.justification.message}</p>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer le mouvement'}
      </Button>
    </form>
  );
}
