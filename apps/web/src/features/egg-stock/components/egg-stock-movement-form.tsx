'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { MANUAL_EGG_STOCK_MOVEMENT_TYPES, type EggStockLotWithRemaining } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreateEggStockMovement } from '../hooks';
import {
  createEggStockMovementSchema,
  type CreateEggStockMovementFormInput,
  type CreateEggStockMovementFormValues,
} from '../schemas';

const typeLabels: Record<(typeof MANUAL_EGG_STOCK_MOVEMENT_TYPES)[number], string> = {
  PERTE_CASSE: 'Casse',
  PERTE_SOUILLURE: 'Souillure',
  CONSOMMATION_INTERNE: 'Consommation interne',
  DON: 'Don',
  PERTE_AUTRE: 'Autre perte',
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EggStockMovementForm({
  batchId,
  lots,
  onSuccess,
}: {
  batchId: string;
  lots: EggStockLotWithRemaining[];
  onSuccess?: () => void;
}) {
  const availableLots = lots.filter((l) => l.remaining > 0);
  const createMutation = useCreateEggStockMovement(batchId);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEggStockMovementFormInput, unknown, CreateEggStockMovementFormValues>({
    resolver: zodResolver(createEggStockMovementSchema),
    defaultValues: { date: todayIsoDate(), type: 'PERTE_CASSE' },
  });

  async function onSubmit(values: CreateEggStockMovementFormValues) {
    try {
      await createMutation.mutateAsync({ ...values, reason: values.reason || undefined });
      toast.success('Perte enregistrée.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  if (availableLots.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun lot avec du stock disponible.</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="esm-lot">Lot</Label>
        <Controller
          name="lotId"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="esm-lot">
                <SelectValue placeholder="Sélectionner…">
                  {(value: string) => {
                    const lot = availableLots.find((l) => l.id === value);
                    return lot
                      ? `${new Date(lot.productionDate).toLocaleDateString('fr-FR')} — ${lot.remaining} restants`
                      : 'Sélectionner…';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableLots.map((lot) => (
                  <SelectItem key={lot.id} value={lot.id}>
                    {new Date(lot.productionDate).toLocaleDateString('fr-FR')} — {lot.remaining} restants
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.lotId ? <p className="text-sm text-destructive">{errors.lotId.message}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="esm-type">Type de perte</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="esm-type">
                <SelectValue>{(value: (typeof MANUAL_EGG_STOCK_MOVEMENT_TYPES)[number]) => typeLabels[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MANUAL_EGG_STOCK_MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {typeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="esm-quantity">Quantité</Label>
          <Input id="esm-quantity" type="number" {...register('quantity')} />
          {errors.quantity ? <p className="text-sm text-destructive">{errors.quantity.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="esm-date">Date</Label>
          <Input id="esm-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="esm-reason">Motif</Label>
        <Textarea id="esm-reason" {...register('reason')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer la perte'}
      </Button>
    </form>
  );
}
