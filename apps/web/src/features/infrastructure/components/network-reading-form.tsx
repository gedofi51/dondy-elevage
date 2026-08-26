'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateNetworkStatusReading } from '../hooks';
import {
  createNetworkStatusReadingSchema,
  networkOperationalStatusLabels,
  networkOperationalStatusOptions,
  todayIsoDate,
  type CreateNetworkStatusReadingFormInput,
  type CreateNetworkStatusReadingFormValues,
} from '../schemas';

export function NetworkReadingForm({ assetId, onSuccess }: { assetId: string; onSuccess?: () => void }) {
  const createMutation = useCreateNetworkStatusReading(assetId);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateNetworkStatusReadingFormInput, unknown, CreateNetworkStatusReadingFormValues>({
    resolver: zodResolver(createNetworkStatusReadingSchema),
    // operationalStatus initialisé : Select contrôlé dès le premier rendu
    // (voir DETTE_TECHNIQUE.md Phase 12).
    defaultValues: { date: todayIsoDate(), operationalStatus: 'OPERATIONNEL' },
  });

  async function onSubmit(values: CreateNetworkStatusReadingFormValues) {
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
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="nsr-date">Date</Label>
          <Input id="nsr-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nsr-status">Statut opérationnel</Label>
          <Controller
            name="operationalStatus"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="nsr-status">
                  <SelectValue>
                    {(value: (typeof networkOperationalStatusOptions)[number]) =>
                      networkOperationalStatusLabels[value]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {networkOperationalStatusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {networkOperationalStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="nsr-observations">Observations</Label>
        <Textarea id="nsr-observations" {...register('observations')} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer le relevé'}
      </Button>
    </form>
  );
}
