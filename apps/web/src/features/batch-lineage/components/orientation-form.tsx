'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CreateOrientationInput } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BuildingSelect, UserSelect } from '@/components/shared/entity-select';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreateOrientation } from '../hooks';
import {
  createOrientationSchema,
  getOrientationVisibleFields,
  transformationTypeOptions,
  type CreateOrientationFormInput,
  type CreateOrientationFormValues,
} from '../schemas';

const transformationLabels: Record<(typeof transformationTypeOptions)[number], string> = {
  CHAIR: 'Chair (nouvelle bande)',
  RENOUVELLEMENT: 'Renouvellement (nouveau lot de poussins)',
  VENTE: 'Vente (nouveau lot de poussins)',
  REFORME_PERTE: 'Réforme / perte',
};

/** Une même incubation peut être orientée en plusieurs fois — `available`
 * est recalculé par l'appelant à chaque rendu (invalidation de la requête
 * batch-lineage après chaque succès) et affiché ici en aide, pas en
 * blocage dur : le 409 serveur (verrouillé, testé en concurrence réelle)
 * reste la seule source de vérité en cas de dépassement. */
export function OrientationForm({
  incubationBatchId,
  available,
}: {
  incubationBatchId: string;
  available: number;
}) {
  const router = useRouter();
  const createMutation = useCreateOrientation(incubationBatchId);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrientationFormInput, unknown, CreateOrientationFormValues>({
    resolver: zodResolver(createOrientationSchema),
    defaultValues: { transformationType: 'CHAIR', buildingId: '', primaryManagerId: '', reason: '' },
  });
  const transformationType = watch('transformationType');
  const quantity = Number(watch('quantity')) || 0;
  const exceedsAvailable = quantity > available;
  const visibleFields = getOrientationVisibleFields(transformationType);

  async function onSubmit(values: CreateOrientationFormValues) {
    let input: CreateOrientationInput;
    if (values.transformationType === 'CHAIR') {
      if (!values.buildingId || !values.primaryManagerId) return;
      input = {
        transformationType: 'CHAIR',
        quantity: values.quantity,
        buildingId: values.buildingId,
        primaryManagerId: values.primaryManagerId,
      };
    } else if (values.transformationType === 'RENOUVELLEMENT') {
      if (!values.buildingId) return;
      input = { transformationType: 'RENOUVELLEMENT', quantity: values.quantity, buildingId: values.buildingId };
    } else if (values.transformationType === 'VENTE') {
      input = { transformationType: 'VENTE', quantity: values.quantity };
    } else {
      if (!values.reason) return;
      input = { transformationType: 'REFORME_PERTE', quantity: values.quantity, reason: values.reason };
    }

    try {
      const lineage = await createMutation.mutateAsync(input);
      toast.success('Poussins orientés.');
      if (lineage.childType === 'broiler_batch' && lineage.childId) {
        router.push(`/poulets-chair/${lineage.childId}`);
      } else if (lineage.childType === 'chick_batch' && lineage.childId) {
        router.push(`/poussins/${lineage.childId}`);
      } else {
        router.push(`/couvoir/${incubationBatchId}`);
      }
    } catch (err) {
      // 409 exact : "Quantité orientée (X) supérieure aux poussins
      // disponibles (Y)." — remonté tel quel, plus utile que le générique.
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’orientation — vérifiez les champs.')
          : 'Échec de l’orientation — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">
        {available.toLocaleString('fr-FR')} poussins disponibles à orienter.
      </p>

      <div className="grid gap-1.5">
        <Label htmlFor="or-destination">Destination</Label>
        <Controller
          name="transformationType"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="or-destination">
                <SelectValue>
                  {(value: (typeof transformationTypeOptions)[number]) => transformationLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {transformationTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {transformationLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="or-quantity">Quantité</Label>
        <Input id="or-quantity" type="number" {...register('quantity')} />
        {errors.quantity ? <p className="text-sm text-destructive">{errors.quantity.message}</p> : null}
        {exceedsAvailable ? (
          <p className="text-sm text-warning">
            Quantité supérieure au solde disponible ({available.toLocaleString('fr-FR')}) — l’enregistrement
            sera refusé par le serveur.
          </p>
        ) : null}
      </div>

      {visibleFields.buildingId ? (
        <BuildingSelect name="buildingId" control={control} error={errors.buildingId?.message} />
      ) : null}

      {visibleFields.primaryManagerId ? (
        <UserSelect
          name="primaryManagerId"
          label="Responsable"
          control={control}
          error={errors.primaryManagerId?.message}
        />
      ) : null}

      {visibleFields.reason ? (
        <div className="grid gap-1.5">
          <Label htmlFor="or-reason">Motif</Label>
          <Textarea id="or-reason" {...register('reason')} />
          {errors.reason ? <p className="text-sm text-destructive">{errors.reason.message}</p> : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Orienter'}
      </Button>
    </form>
  );
}
