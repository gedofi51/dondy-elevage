'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreateWaterReading } from '../hooks';
import {
  createWaterReadingSchema,
  type CreateWaterReadingFormInput,
  type CreateWaterReadingFormValues,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WaterReadingForm({ waterPointId }: { waterPointId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const createMutation = useCreateWaterReading(waterPointId);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateWaterReadingFormInput, unknown, CreateWaterReadingFormValues>({
    resolver: zodResolver(createWaterReadingSchema),
    defaultValues: { date: todayIsoDate() },
  });

  const indexMatin = Number(watch('indexMatin'));
  const indexSoir = Number(watch('indexSoir'));
  const hasAnomaly = !Number.isNaN(indexMatin) && !Number.isNaN(indexSoir) && indexSoir < indexMatin;

  async function onSubmit(values: CreateWaterReadingFormValues) {
    setServerError(null);
    try {
      await createMutation.mutateAsync(values);
      toast.success('Relevé enregistré.');
      router.push(`/points-eau/${waterPointId}`);
    } catch (err) {
      // Le calcul serveur de l'écart caisse/théorique peut exiger
      // `remarks` (409) — jamais recalculé côté client, surfacé tel quel.
      setServerError(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement du relevé.')
          : 'Échec de l’enregistrement du relevé.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="wr-date">Date</Label>
        <Input id="wr-date" type="date" {...register('date')} />
        {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="wr-matin">Index du matin</Label>
          <Input id="wr-matin" type="number" step="0.01" {...register('indexMatin')} />
          {errors.indexMatin ? (
            <p className="text-sm text-destructive">{errors.indexMatin.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wr-soir">Index du soir</Label>
          <Input id="wr-soir" type="number" step="0.01" {...register('indexSoir')} />
          {errors.indexSoir ? (
            <p className="text-sm text-destructive">{errors.indexSoir.message}</p>
          ) : null}
        </div>
      </div>

      {hasAnomaly ? (
        <div className="flex flex-col gap-4 rounded-md border border-warning/40 bg-warning/5 p-3">
          <p className="text-sm text-warning">
            Index du soir inférieur à celui du matin — anomalie à documenter (remplacement de
            compteur, etc.).
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="wr-consumption">Consommation réelle (m³)</Label>
            <Input id="wr-consumption" type="number" step="0.01" {...register('consumptionM3')} />
            {errors.consumptionM3 ? (
              <p className="text-sm text-destructive">{errors.consumptionM3.message}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wr-anomaly-reason">Raison de l’anomalie</Label>
            <Textarea id="wr-anomaly-reason" {...register('indexAnomalyReason')} />
            {errors.indexAnomalyReason ? (
              <p className="text-sm text-destructive">{errors.indexAnomalyReason.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="wr-cash">Encaissé (FCFA)</Label>
        <Input id="wr-cash" type="number" {...register('cashAmountFcfa')} />
        {errors.cashAmountFcfa ? (
          <p className="text-sm text-destructive">{errors.cashAmountFcfa.message}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="wr-remarks">Remarques</Label>
        <Textarea id="wr-remarks" {...register('remarks')} />
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer le relevé'}
      </Button>
    </form>
  );
}
