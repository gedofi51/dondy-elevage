'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateMortality } from '../hooks';
import {
  createMortalitySchema,
  mortalityCauseOptions,
  type CreateMortalityFormInput,
  type CreateMortalityFormValues,
} from '../schemas';

const causeLabels: Record<(typeof mortalityCauseOptions)[number], string> = {
  INCONNUE: 'Inconnue',
  MALADIE: 'Maladie',
  ACCIDENT: 'Accident',
  ETOUFFEMENT: 'Étouffement',
  CHALEUR: 'Chaleur',
  FROID: 'Froid',
  PROBLEME_ALIMENTAIRE: 'Problème alimentaire',
  PROBLEME_EAU: 'Problème eau',
  PREDATEUR: 'Prédateur',
  AUTRE: 'Autre',
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MortalityForm({ batchId, onSuccess }: { batchId: string; onSuccess?: () => void }) {
  const createMutation = useCreateMortality(batchId);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMortalityFormInput, unknown, CreateMortalityFormValues>({
    resolver: zodResolver(createMortalitySchema),
    defaultValues: { date: todayIsoDate(), quantity: 1 },
  });

  async function onSubmit(values: CreateMortalityFormValues) {
    try {
      await createMutation.mutateAsync({ ...values, observation: values.observation || undefined });
      toast.success('Mortalité enregistrée.');
      onSuccess?.();
    } catch {
      toast.error('Échec de l’enregistrement.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="mort-date">Date</Label>
          <Input id="mort-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mort-day">Jour (J1-J45)</Label>
          <Input id="mort-day" type="number" min={1} max={45} {...register('dayNumber')} />
          {errors.dayNumber ? (
            <p className="text-sm text-destructive">{errors.dayNumber.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="mort-quantity">Quantité</Label>
        <Input id="mort-quantity" type="number" {...register('quantity')} />
        {errors.quantity ? <p className="text-sm text-destructive">{errors.quantity.message}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="mort-cause">Cause</Label>
        <Controller
          name="cause"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="mort-cause">
                {/* SelectValue affiche la value brute sans mapping explicite
                    — voir DETTE_TECHNIQUE.md Phase 11. */}
                <SelectValue placeholder="Sélectionner…">
                  {(value: (typeof mortalityCauseOptions)[number]) =>
                    value ? causeLabels[value] : 'Sélectionner…'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {mortalityCauseOptions.map((cause) => (
                  <SelectItem key={cause} value={cause}>
                    {causeLabels[cause]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="mort-observation">Observation</Label>
        <Textarea id="mort-observation" {...register('observation')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
