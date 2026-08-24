'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { CreateHealthEventInput } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useItems } from '@/features/items/hooks';
import { useCreateHealthEvent } from '../hooks';
import {
  createHealthEventSchema,
  healthEventRouteOptions,
  healthEventStatusOptions,
  healthEventTypeOptions,
  type CreateHealthEventFormInput,
  type CreateHealthEventFormValues,
} from '../schemas';

const typeLabels: Record<(typeof healthEventTypeOptions)[number], string> = {
  VACCINATION: 'Vaccination',
  TRAITEMENT: 'Traitement',
  PROPHYLAXIE: 'Prophylaxie',
  DESINFECTION: 'Désinfection',
  VITAMINE: 'Vitamine',
  CONSULTATION_VETERINAIRE: 'Consultation vétérinaire',
};

const statusLabels: Record<(typeof healthEventStatusOptions)[number], string> = {
  PREVU: 'Prévu',
  REALISE: 'Réalisé',
  REPORTE: 'Reporté',
  ANNULE: 'Annulé',
};

const routeLabels: Record<(typeof healthEventRouteOptions)[number], string> = {
  EAU: 'Eau de boisson',
  INJECTION: 'Injection',
  AUTRE: 'Autre',
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HealthEventForm({ batchId, onSuccess }: { batchId: string; onSuccess?: () => void }) {
  const { data: items } = useItems();
  const itemsById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const createMutation = useCreateHealthEvent(batchId);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateHealthEventFormInput, unknown, CreateHealthEventFormValues>({
    resolver: zodResolver(createHealthEventSchema),
    defaultValues: { date: todayIsoDate(), type: 'TRAITEMENT', status: 'PREVU' },
  });
  const itemId = watch('itemId');
  const status = watch('status');

  async function onSubmit(values: CreateHealthEventFormValues) {
    try {
      const input: CreateHealthEventInput = {
        ...values,
        itemId: values.itemId || undefined,
        product: values.product || undefined,
        motif: values.motif || undefined,
        dose: values.dose || undefined,
        quantity: values.quantity || undefined,
        unit: values.unit || undefined,
        prescribedBy: values.prescribedBy || undefined,
        performedBy: values.performedBy || undefined,
        observation: values.observation || undefined,
      };
      await createMutation.mutateAsync(input);
      toast.success('Événement sanitaire enregistré.');
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
          <Label htmlFor="he-date">Date</Label>
          <Input id="he-date" type="date" {...register('date')} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="he-type">Type</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="he-type">
                  <SelectValue>{(value: (typeof healthEventTypeOptions)[number]) => typeLabels[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {healthEventTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {typeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="he-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="he-status">
                <SelectValue placeholder="Sélectionner…">
                  {(value: (typeof healthEventStatusOptions)[number]) => statusLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {healthEventStatusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="he-item">Article de stock (optionnel)</Label>
        <Controller
          name="itemId"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="he-item">
                <SelectValue placeholder="Aucun">
                  {(value: string) => (value ? (itemsById.get(value) ?? value) : 'Aucun')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {itemId && status === 'REALISE' ? (
          <p className="text-xs text-muted-foreground">
            Un mouvement de stock (sortie) sera déclenché pour cet article.
          </p>
        ) : null}
      </div>

      {itemId ? (
        <div className="grid gap-1.5">
          <Label htmlFor="he-quantity-used">Quantité utilisée</Label>
          <Input id="he-quantity-used" type="number" step="0.01" {...register('quantityUsed')} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="he-product">Produit</Label>
          <Input id="he-product" {...register('product')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="he-dose">Dose</Label>
          <Input id="he-dose" {...register('dose')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="he-quantity">Quantité (texte libre)</Label>
          <Input id="he-quantity" {...register('quantity')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="he-unit">Unité</Label>
          <Input id="he-unit" {...register('unit')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="he-duration">Durée (jours)</Label>
          <Input id="he-duration" type="number" {...register('durationDays')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="he-route">Voie d’administration</Label>
          <Controller
            name="administrationRoute"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="he-route">
                  <SelectValue placeholder="Sélectionner…">
                    {(value: (typeof healthEventRouteOptions)[number]) =>
                      value ? routeLabels[value] : 'Sélectionner…'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {healthEventRouteOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {routeLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="he-motif">Motif</Label>
        <Textarea id="he-motif" {...register('motif')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="he-prescribed-by">Prescrit par</Label>
          <Input id="he-prescribed-by" {...register('prescribedBy')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="he-performed-by">Réalisé par</Label>
          <Input id="he-performed-by" {...register('performedBy')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="he-cost">Coût (FCFA)</Label>
        <Input id="he-cost" type="number" {...register('costFcfa')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="he-observation">Observation</Label>
        <Textarea id="he-observation" {...register('observation')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
