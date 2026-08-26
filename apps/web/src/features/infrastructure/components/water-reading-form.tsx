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
import { useCreateWaterInfrastructureReading } from '../hooks';
import {
  createWaterInfrastructureReadingSchema,
  todayIsoDate,
  type CreateWaterInfrastructureReadingFormInput,
  type CreateWaterInfrastructureReadingFormValues,
} from '../schemas';

export function WaterReadingForm({ assetId, onSuccess }: { assetId: string; onSuccess?: () => void }) {
  const createMutation = useCreateWaterInfrastructureReading(assetId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateWaterInfrastructureReadingFormInput, unknown, CreateWaterInfrastructureReadingFormValues>({
    resolver: zodResolver(createWaterInfrastructureReadingSchema),
    defaultValues: { date: todayIsoDate() },
  });

  async function onSubmit(values: CreateWaterInfrastructureReadingFormValues) {
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
        <Label htmlFor="wir-date">Date</Label>
        <Input id="wir-date" type="date" {...register('date')} />
        {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="wir-pumped">Volume pompé (m³)</Label>
          <Input id="wir-pumped" type="number" step="0.01" {...register('pumpedVolumeM3')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wir-reservoir">Niveau réservoir (%)</Label>
          <Input id="wir-reservoir" type="number" step="0.01" {...register('reservoirLevelPercent')} />
          {errors.reservoirLevelPercent ? (
            <p className="text-sm text-destructive">{errors.reservoirLevelPercent.message}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="wir-pump-hours">Cumul heures de pompage</Label>
          <Input id="wir-pump-hours" type="number" step="0.01" {...register('pumpHoursCumulative')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wir-internal">Consommation ferme (m³)</Label>
          <Input id="wir-internal" type="number" step="0.01" {...register('farmInternalConsumptionM3')} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        L’écart de l’équation de contrôle (production vs consommation + vente) sera calculé par le
        serveur et affiché après enregistrement.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="wir-observations">Observations</Label>
        <Textarea id="wir-observations" {...register('observations')} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer le relevé'}
      </Button>
    </form>
  );
}
