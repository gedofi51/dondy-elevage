'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { ChickBatchWithComputed } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { BuildingSelect } from '@/components/shared/entity-select';
import { useUpdateChickBatch } from '../hooks';
import { updateChickBatchSchema, type UpdateChickBatchFormInput, type UpdateChickBatchFormValues } from '../schemas';

/** Édition minimale — buildingId uniquement (voir DETTE_TECHNIQUE.md
 * Phase 13 : aucun endpoint dédié de clôture/annulation pour ChickBatch,
 * pas de sélecteur de statut exposé côté UI cette phase). */
export function ChickBatchForm({ batch }: { batch: ChickBatchWithComputed }) {
  const router = useRouter();
  const updateMutation = useUpdateChickBatch(batch.id);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateChickBatchFormInput, unknown, UpdateChickBatchFormValues>({
    resolver: zodResolver(updateChickBatchSchema),
    defaultValues: { buildingId: batch.buildingId ?? '' },
  });

  async function onSubmit(values: UpdateChickBatchFormValues) {
    try {
      await updateMutation.mutateAsync(values);
      toast.success('Lot modifié.');
      router.push(`/poussins/${batch.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement — vérifiez les champs.')
          : 'Échec de l’enregistrement — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <BuildingSelect name="buildingId" control={control} error={errors.buildingId?.message} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
