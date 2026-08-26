'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSolarInfrastructureReading } from '../hooks';
import {
  createSolarInfrastructureReadingSchema,
  todayIsoDate,
  type CreateSolarInfrastructureReadingFormInput,
  type CreateSolarInfrastructureReadingFormValues,
} from '../schemas';

export function SolarReadingForm({ assetId, onSuccess }: { assetId: string; onSuccess?: () => void }) {
  const createMutation = useCreateSolarInfrastructureReading(assetId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateSolarInfrastructureReadingFormInput, unknown, CreateSolarInfrastructureReadingFormValues>({
    resolver: zodResolver(createSolarInfrastructureReadingSchema),
    defaultValues: { date: todayIsoDate() },
  });

  async function onSubmit(values: CreateSolarInfrastructureReadingFormValues) {
    try {
      await createMutation.mutateAsync({ ...values, observations: values.observations || undefined });
      toast.success('Relevé enregistré.');
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
        <Label htmlFor="sir-date">Date</Label>
        <Input id="sir-date" type="date" {...register('date')} />
        {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sir-production">Production journalière (kWh)</Label>
          <Input id="sir-production" type="number" step="0.01" {...register('dailyProductionKwh')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sir-battery">Charge batterie (%)</Label>
          <Input id="sir-battery" type="number" step="0.01" {...register('batteryChargePercent')} />
          {errors.batteryChargePercent ? (
            <p className="text-sm text-destructive">{errors.batteryChargePercent.message}</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sir-power">Puissance instantanée (kW)</Label>
        <Input id="sir-power" type="number" step="0.01" {...register('instantaneousPowerKw')} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sir-observations">Observations</Label>
        <Textarea id="sir-observations" {...register('observations')} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer le relevé'}
      </Button>
    </form>
  );
}
