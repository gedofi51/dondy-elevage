'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { BreederBatchWithComputed } from '@dondy-elevage/shared-types';
import { BREEDER_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockSelect, BuildingSelect, UserSelect } from '@/components/shared/entity-select';
import { useCreateBreederBatch, useUpdateBreederBatch } from '../hooks';
import {
  createBreederBatchSchema,
  updateBreederBatchSchema,
  type CreateBreederBatchFormInput,
  type CreateBreederBatchFormValues,
  type UpdateBreederBatchFormInput,
  type UpdateBreederBatchFormValues,
} from '../schemas';

const statusLabels: Record<(typeof BREEDER_BATCH_EDITABLE_STATUSES)[number], string> = {
  ACTIF: 'Actif',
  REFORME: 'Réforme',
};

export function BreederBatchForm({ batch }: { batch?: BreederBatchWithComputed }) {
  return batch ? <EditBreederBatchForm batch={batch} /> : <CreateBreederBatchForm />;
}

function CreateBreederBatchForm() {
  const router = useRouter();
  const createMutation = useCreateBreederBatch();
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBreederBatchFormInput, unknown, CreateBreederBatchFormValues>({
    resolver: zodResolver(createBreederBatchSchema),
    // buildingId/primaryManagerId initialisés à '' : sans valeur par défaut,
    // le Select démarre non contrôlé puis devient contrôlé dès la première
    // sélection — warning base-ui (voir DETTE_TECHNIQUE.md Phase 12).
    defaultValues: { buildingId: '', blockId: '', primaryManagerId: '' },
  });
  const buildingId = watch('buildingId');

  async function onSubmit(values: CreateBreederBatchFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        strain: values.strain || undefined,
        blockId: values.blockId || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Lot créé.');
      router.push(`/reproducteurs/${created.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création — vérifiez les champs.')
          : 'Échec de la création — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-constitution-date">Date de constitution</Label>
          <Input id="bb-constitution-date" type="date" {...register('constitutionDate')} />
          {errors.constitutionDate ? (
            <p className="text-sm text-destructive">{errors.constitutionDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-strain">Souche</Label>
          <Input id="bb-strain" {...register('strain')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-female-count">Effectif femelles</Label>
          <Input id="bb-female-count" type="number" {...register('femaleCount')} />
          {errors.femaleCount ? (
            <p className="text-sm text-destructive">{errors.femaleCount.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-male-count">Effectif mâles</Label>
          <Input id="bb-male-count" type="number" {...register('maleCount')} />
          {errors.maleCount ? (
            <p className="text-sm text-destructive">{errors.maleCount.message}</p>
          ) : null}
        </div>
      </div>

      <BuildingSelect name="buildingId" control={control} error={errors.buildingId?.message} />
      <BlockSelect
        name="blockId"
        control={control}
        error={errors.blockId?.message}
        buildingId={buildingId}
      />
      <UserSelect
        name="primaryManagerId"
        label="Responsable"
        control={control}
        error={errors.primaryManagerId?.message}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="bb-observations">Observations</Label>
        <Textarea id="bb-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le lot'}
      </Button>
    </form>
  );
}

function EditBreederBatchForm({ batch }: { batch: BreederBatchWithComputed }) {
  const router = useRouter();
  const updateMutation = useUpdateBreederBatch(batch.id);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBreederBatchFormInput, unknown, UpdateBreederBatchFormValues>({
    resolver: zodResolver(updateBreederBatchSchema),
    defaultValues: {
      strain: batch.strain ?? '',
      constitutionDate: batch.constitutionDate.slice(0, 10),
      femaleCount: batch.femaleCount,
      maleCount: batch.maleCount,
      buildingId: batch.buildingId,
      blockId: batch.blockId ?? '',
      primaryManagerId: batch.primaryManagerId,
      observations: batch.observations ?? '',
      status: batch.status as (typeof BREEDER_BATCH_EDITABLE_STATUSES)[number],
    },
  });
  const buildingId = watch('buildingId');

  async function onSubmit(values: UpdateBreederBatchFormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        strain: values.strain || undefined,
        // '' -> null explicite : un champ vidé doit effacer le bloc en
        // base, pas être ignoré par le PATCH partiel.
        blockId: values.blockId || null,
        observations: values.observations || undefined,
      });
      toast.success('Lot modifié.');
      router.push(`/reproducteurs/${batch.id}`);
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
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-constitution-date">Date de constitution</Label>
          <Input id="bb-constitution-date" type="date" {...register('constitutionDate')} />
          {errors.constitutionDate ? (
            <p className="text-sm text-destructive">{errors.constitutionDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-strain">Souche</Label>
          <Input id="bb-strain" {...register('strain')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-female-count">Effectif femelles</Label>
          <Input id="bb-female-count" type="number" {...register('femaleCount')} />
          {errors.femaleCount ? (
            <p className="text-sm text-destructive">{errors.femaleCount.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-male-count">Effectif mâles</Label>
          <Input id="bb-male-count" type="number" {...register('maleCount')} />
          {errors.maleCount ? (
            <p className="text-sm text-destructive">{errors.maleCount.message}</p>
          ) : null}
        </div>
      </div>

      <BuildingSelect name="buildingId" control={control} error={errors.buildingId?.message} />
      <BlockSelect
        name="blockId"
        control={control}
        error={errors.blockId?.message}
        buildingId={buildingId}
      />
      <UserSelect
        name="primaryManagerId"
        label="Responsable"
        control={control}
        error={errors.primaryManagerId?.message}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="bb-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="bb-status">
                <SelectValue>
                  {(value: (typeof BREEDER_BATCH_EDITABLE_STATUSES)[number]) => statusLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BREEDER_BATCH_EDITABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bb-observations">Observations</Label>
        <Textarea id="bb-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
