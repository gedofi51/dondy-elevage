'use client';

import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { LayerBatchWithComputed } from '@dondy-elevage/shared-types';
import { LAYER_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUsers } from '@/features/users/hooks';
import { useBuildings } from '@/features/buildings/hooks';
import { useCreateLayerBatch, useUpdateLayerBatch } from '../hooks';
import {
  createLayerBatchSchema,
  updateLayerBatchSchema,
  type CreateLayerBatchFormInput,
  type CreateLayerBatchFormValues,
  type UpdateLayerBatchFormInput,
  type UpdateLayerBatchFormValues,
} from '../schemas';

const statusLabels: Record<(typeof LAYER_BATCH_EDITABLE_STATUSES)[number], string> = {
  ELEVAGE: 'Élevage',
  PONTE: 'Ponte',
  REFORME: 'Réforme',
};

function UserSelect<T extends FieldValues>({
  name,
  label,
  control,
  error,
}: {
  name: Path<T>;
  label: string;
  control: Control<T>;
  error?: string;
}) {
  const { data: users } = useUsers();
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              {/* SelectValue sans `items`/`itemToStringLabel` affiche la value
                  brute (UUID) une fois sélectionnée — bug base-ui documenté
                  dans DETTE_TECHNIQUE.md, children-function requis. */}
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (usersById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {users?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function BuildingSelect<T extends FieldValues>({
  name,
  control,
  error,
}: {
  name: Path<T>;
  control: Control<T>;
  error?: string;
}) {
  const { data: buildings } = useBuildings();
  const buildingsById = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>Bâtiment</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (buildingsById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {buildings?.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function LayerBatchForm({ batch }: { batch?: LayerBatchWithComputed }) {
  return batch ? <EditLayerBatchForm batch={batch} /> : <CreateLayerBatchForm />;
}

function CreateLayerBatchForm() {
  const router = useRouter();
  const createMutation = useCreateLayerBatch();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLayerBatchFormInput, unknown, CreateLayerBatchFormValues>({
    resolver: zodResolver(createLayerBatchSchema),
    // buildingId/primaryManagerId initialisés à '' : sans valeur par
    // défaut, le Select démarre non contrôlé (field.value===undefined)
    // puis devient contrôlé dès la première sélection — base-ui avertit
    // (et React déconseille) ce changement de mode en cours de vie du
    // composant. Trouvé en vérification manuelle.
    defaultValues: { buildingId: '', primaryManagerId: '' },
  });

  async function onSubmit(values: CreateLayerBatchFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        strain: values.strain || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Lot créé.');
      router.push(`/pondeuses/${created.id}`);
    } catch {
      toast.error('Échec de la création — vérifiez les champs.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="lb-entry-date">Date d’entrée</Label>
          <Input id="lb-entry-date" type="date" {...register('entryDate')} />
          {errors.entryDate ? (
            <p className="text-sm text-destructive">{errors.entryDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lb-strain">Souche</Label>
          <Input id="lb-strain" {...register('strain')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lb-initial-quantity">Effectif initial</Label>
        <Input id="lb-initial-quantity" type="number" {...register('initialQuantity')} />
        {errors.initialQuantity ? (
          <p className="text-sm text-destructive">{errors.initialQuantity.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="lb-age-weeks">Âge à l’entrée (semaines)</Label>
          <Input id="lb-age-weeks" type="number" {...register('ageAtEntryWeeks')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lb-age-days">Âge à l’entrée (jours)</Label>
          <Input id="lb-age-days" type="number" {...register('ageAtEntryDays')} />
        </div>
      </div>

      <BuildingSelect name="buildingId" control={control} error={errors.buildingId?.message} />
      <UserSelect
        name="primaryManagerId"
        label="Responsable"
        control={control}
        error={errors.primaryManagerId?.message}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="lb-observations">Observations</Label>
        <Textarea id="lb-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le lot'}
      </Button>
    </form>
  );
}

function EditLayerBatchForm({ batch }: { batch: LayerBatchWithComputed }) {
  const router = useRouter();
  const updateMutation = useUpdateLayerBatch(batch.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateLayerBatchFormInput, unknown, UpdateLayerBatchFormValues>({
    resolver: zodResolver(updateLayerBatchSchema),
    defaultValues: {
      entryDate: batch.entryDate.slice(0, 10),
      strain: batch.strain ?? '',
      initialQuantity: batch.initialQuantity,
      ageAtEntryWeeks: batch.ageAtEntryWeeks ?? undefined,
      ageAtEntryDays: batch.ageAtEntryDays ?? undefined,
      buildingId: batch.buildingId,
      primaryManagerId: batch.primaryManagerId,
      observations: batch.observations ?? '',
      status: batch.status as (typeof LAYER_BATCH_EDITABLE_STATUSES)[number],
    },
  });

  async function onSubmit(values: UpdateLayerBatchFormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        strain: values.strain || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Lot modifié.');
      router.push(`/pondeuses/${batch.id}`);
    } catch {
      toast.error('Échec de l’enregistrement — vérifiez les champs.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="lb-entry-date">Date d’entrée</Label>
          <Input id="lb-entry-date" type="date" {...register('entryDate')} />
          {errors.entryDate ? (
            <p className="text-sm text-destructive">{errors.entryDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lb-strain">Souche</Label>
          <Input id="lb-strain" {...register('strain')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lb-initial-quantity">Effectif initial</Label>
        <Input id="lb-initial-quantity" type="number" {...register('initialQuantity')} />
        {errors.initialQuantity ? (
          <p className="text-sm text-destructive">{errors.initialQuantity.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="lb-age-weeks">Âge à l’entrée (semaines)</Label>
          <Input id="lb-age-weeks" type="number" {...register('ageAtEntryWeeks')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lb-age-days">Âge à l’entrée (jours)</Label>
          <Input id="lb-age-days" type="number" {...register('ageAtEntryDays')} />
        </div>
      </div>

      <BuildingSelect name="buildingId" control={control} error={errors.buildingId?.message} />
      <UserSelect
        name="primaryManagerId"
        label="Responsable"
        control={control}
        error={errors.primaryManagerId?.message}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="lb-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="lb-status">
                <SelectValue>
                  {(value: (typeof LAYER_BATCH_EDITABLE_STATUSES)[number]) => statusLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LAYER_BATCH_EDITABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          La clôture se fait depuis une action dédiée sur la fiche du lot.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lb-observations">Observations</Label>
        <Textarea id="lb-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
