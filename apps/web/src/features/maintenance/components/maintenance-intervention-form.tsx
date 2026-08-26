'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ItemSelect } from '@/components/shared/entity-select';
import { useItems } from '@/features/items/hooks';
import { useCreateMaintenanceIntervention } from '../hooks';
import { computePartsCostPreviewFcfa } from '../intervention-cost-preview';
import {
  createMaintenanceInterventionSchema,
  type CreateMaintenanceInterventionFormInput,
  type CreateMaintenanceInterventionFormValues,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** assetId/taskId connus du contexte — jamais dans le schéma Zod (voir
 * DETTE_TECHNIQUE.md Phase 14). Premier useFieldArray du projet à
 * l'intérieur d'un Dialog (élargi côté appelant, sm:max-w-xl) — exception
 * assumée, pas un nouveau défaut (voir DETTE_TECHNIQUE.md Phase 19). */
export function MaintenanceInterventionForm({
  assetId,
  taskId,
  onSuccess,
}: {
  assetId: string;
  taskId?: string;
  onSuccess?: () => void;
}) {
  const createMutation = useCreateMaintenanceIntervention();
  const { data: items } = useItems();
  const itemsById = new Map((items ?? []).map((i) => [i.id, i]));
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaintenanceInterventionFormInput, unknown, CreateMaintenanceInterventionFormValues>(
    {
      resolver: zodResolver(createMaintenanceInterventionSchema),
      defaultValues: { interventionDate: todayIsoDate(), parts: [] },
    },
  );
  const { fields, append, remove } = useFieldArray({ control, name: 'parts' });
  const watchedParts = watch('parts');

  async function onSubmit(values: CreateMaintenanceInterventionFormValues) {
    try {
      await createMutation.mutateAsync({
        assetId,
        taskId,
        ...values,
        diagnosis: values.diagnosis || undefined,
        performedBy: values.performedBy || undefined,
        parts: values.parts && values.parts.length > 0 ? values.parts : undefined,
      });
      toast.success('Intervention enregistrée.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  const partsCostPreview = computePartsCostPreviewFcfa(
    (watchedParts ?? [])
      .filter((p) => p?.itemId)
      .map((p) => ({
        quantity: Number(p?.quantity) || 0,
        averageUnitCostFcfa: itemsById.get(p!.itemId)?.averageUnitCostFcfa ?? 0,
      })),
  );
  const laborCost = Number(watch('laborCostFcfa')) || 0;
  const totalCostPreview = laborCost + partsCostPreview;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="int-date">Date d’intervention</Label>
          <Input id="int-date" type="date" {...register('interventionDate')} />
          {errors.interventionDate ? (
            <p className="text-sm text-destructive">{errors.interventionDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="int-performed-by">Intervenant</Label>
          <Input id="int-performed-by" {...register('performedBy')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="int-diagnosis">Diagnostic</Label>
        <Textarea id="int-diagnosis" {...register('diagnosis')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="int-labor-cost">Coût main-d’œuvre (FCFA)</Label>
        <Input id="int-labor-cost" type="number" {...register('laborCostFcfa')} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-primary">Pièces utilisées</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ itemId: '', quantity: 1 })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter une pièce
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <ItemSelect
                  name={`parts.${index}.itemId`}
                  control={control}
                  error={errors.parts?.[index]?.itemId?.message}
                />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`int-qty-${index}`}>Quantité</Label>
              <Input
                id={`int-qty-${index}`}
                type="number"
                step="0.001"
                {...register(`parts.${index}.quantity`)}
              />
              {errors.parts?.[index]?.quantity ? (
                <p className="text-sm text-destructive">{errors.parts[index]?.quantity?.message}</p>
              ) : null}
            </div>
          </div>
        ))}

        {fields.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Coût pièces estimé (informatif) : {partsCostPreview.toLocaleString('fr-FR')} FCFA
          </p>
        ) : null}
      </section>

      <p className="text-right text-sm font-medium text-foreground">
        Coût total estimé (informatif) : {totalCostPreview.toLocaleString('fr-FR')} FCFA
      </p>
      <p className="text-xs text-muted-foreground">
        Estimation basée sur le coût moyen actuel des articles — le montant réellement imputé à
        l’enregistrement peut différer légèrement.
      </p>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer l’intervention'}
      </Button>
    </form>
  );
}
