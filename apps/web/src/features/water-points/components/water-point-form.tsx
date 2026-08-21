'use client';

import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUsers } from '@/features/users/hooks';
import { useCreateWaterPoint, useUpdateWaterPoint } from '../hooks';
import {
  createWaterPointSchema,
  updateWaterPointSchema,
  waterPointStatusOptions,
  type CreateWaterPointFormInput,
  type CreateWaterPointFormValues,
  type UpdateWaterPointFormInput,
  type UpdateWaterPointFormValues,
} from '../schemas';
import type { WaterPoint } from '@dondy-elevage/shared-types';

const statusLabels: Record<(typeof waterPointStatusOptions)[number], string> = {
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  MAINTENANCE: 'Maintenance',
};

/** Composant public : dispatch création/édition — chaque variante a son
 * propre schéma Zod (types incompatibles : initialIndex vs status),
 * volontairement séparées plutôt qu'un type union difficile à typer
 * proprement avec zodResolver. */
export function WaterPointForm({ waterPoint }: { waterPoint?: WaterPoint }) {
  return waterPoint ? <EditWaterPointForm waterPoint={waterPoint} /> : <CreateWaterPointForm />;
}

function ResponsibleSelect<T extends FieldValues & { responsibleId: string }>({
  control,
  error,
}: {
  control: Control<T>;
  error?: string;
}) {
  const { data: users } = useUsers();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="wp-responsible">Responsable</Label>
      <Controller
        name={'responsibleId' as Path<T>}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="wp-responsible">
              <SelectValue placeholder="Sélectionner…" />
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

function CreateWaterPointForm() {
  const router = useRouter();
  const createMutation = useCreateWaterPoint();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateWaterPointFormInput, unknown, CreateWaterPointFormValues>({
    resolver: zodResolver(createWaterPointSchema),
    defaultValues: { initialIndex: 0 },
  });

  async function onSubmit(values: CreateWaterPointFormValues) {
    try {
      const created = await createMutation.mutateAsync(values);
      toast.success('Point d’eau créé.');
      router.push(`/points-eau/${created.id}`);
    } catch {
      toast.error('Échec de la création — vérifiez les champs.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-name">Nom</Label>
        <Input id="wp-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-location">Emplacement</Label>
        <Input id="wp-location" {...register('location')} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-meter">Référence compteur</Label>
        <Input id="wp-meter" {...register('meterReference')} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-initial-index">Index initial</Label>
        <Input id="wp-initial-index" type="number" step="0.01" {...register('initialIndex')} />
        {errors.initialIndex ? (
          <p className="text-sm text-destructive">{errors.initialIndex.message}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-tariff">Tarif (FCFA/m³)</Label>
        <Input id="wp-tariff" type="number" {...register('tariffFcfaPerM3')} />
        {errors.tariffFcfaPerM3 ? (
          <p className="text-sm text-destructive">{errors.tariffFcfaPerM3.message}</p>
        ) : null}
      </div>
      <ResponsibleSelect control={control} error={errors.responsibleId?.message} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le point d’eau'}
      </Button>
    </form>
  );
}

function EditWaterPointForm({ waterPoint }: { waterPoint: WaterPoint }) {
  const router = useRouter();
  const updateMutation = useUpdateWaterPoint(waterPoint.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateWaterPointFormInput, unknown, UpdateWaterPointFormValues>({
    resolver: zodResolver(updateWaterPointSchema),
    defaultValues: {
      name: waterPoint.name,
      location: waterPoint.location ?? '',
      meterReference: waterPoint.meterReference ?? '',
      tariffFcfaPerM3: waterPoint.tariffFcfaPerM3,
      responsibleId: waterPoint.responsibleId,
      status: waterPoint.status,
    },
  });

  async function onSubmit(values: UpdateWaterPointFormValues) {
    try {
      await updateMutation.mutateAsync(values);
      toast.success('Point d’eau modifié.');
      router.push(`/points-eau/${waterPoint.id}`);
    } catch {
      toast.error('Échec de l’enregistrement — vérifiez les champs.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-name">Nom</Label>
        <Input id="wp-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-location">Emplacement</Label>
        <Input id="wp-location" {...register('location')} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-meter">Référence compteur</Label>
        <Input id="wp-meter" {...register('meterReference')} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-tariff">Tarif (FCFA/m³)</Label>
        <Input id="wp-tariff" type="number" {...register('tariffFcfaPerM3')} />
        {errors.tariffFcfaPerM3 ? (
          <p className="text-sm text-destructive">{errors.tariffFcfaPerM3.message}</p>
        ) : null}
      </div>
      <ResponsibleSelect control={control} error={errors.responsibleId?.message} />
      <div className="grid gap-1.5">
        <Label htmlFor="wp-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="wp-status">
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {waterPointStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
