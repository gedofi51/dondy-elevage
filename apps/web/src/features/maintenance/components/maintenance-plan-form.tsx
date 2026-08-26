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
import { useCreateMaintenancePlan } from '../hooks';
import {
  createMaintenancePlanSchema,
  type CreateMaintenancePlanFormInput,
  type CreateMaintenancePlanFormValues,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** assetId connu du contexte (fiche déjà ouverte) — jamais dans le schéma
 * Zod, injecté au payload à la soumission (voir DETTE_TECHNIQUE.md
 * Phase 14, leçon itemId/stock-movement-form.tsx). */
export function MaintenancePlanForm({
  assetId,
  onSuccess,
}: {
  assetId: string;
  onSuccess?: () => void;
}) {
  const createMutation = useCreateMaintenancePlan();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaintenancePlanFormInput, unknown, CreateMaintenancePlanFormValues>({
    resolver: zodResolver(createMaintenancePlanSchema),
    defaultValues: { startDate: todayIsoDate() },
  });

  async function onSubmit(values: CreateMaintenancePlanFormValues) {
    try {
      await createMutation.mutateAsync({
        assetId,
        ...values,
        observations: values.observations || undefined,
      });
      toast.success('Plan de maintenance créé.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création.')
          : 'Échec de la création.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="plan-designation">Désignation</Label>
        <Input id="plan-designation" {...register('designation')} />
        {errors.designation ? (
          <p className="text-sm text-destructive">{errors.designation.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="plan-periodicity">Périodicité (jours)</Label>
          <Input id="plan-periodicity" type="number" {...register('periodicityDays')} />
          {errors.periodicityDays ? (
            <p className="text-sm text-destructive">{errors.periodicityDays.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="plan-start-date">Première échéance</Label>
          <Input id="plan-start-date" type="date" {...register('startDate')} />
          {errors.startDate ? (
            <p className="text-sm text-destructive">{errors.startDate.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="plan-observations">Observations</Label>
        <Textarea id="plan-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le plan'}
      </Button>
    </form>
  );
}
