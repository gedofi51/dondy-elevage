'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Building } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateBuilding, useUpdateBuilding } from '../hooks';
import {
  buildingTypeOptions,
  createBuildingSchema,
  updateBuildingSchema,
  type CreateBuildingFormInput,
  type CreateBuildingFormValues,
  type UpdateBuildingFormInput,
  type UpdateBuildingFormValues,
} from '../schemas';

const typeLabelByValue = new Map(buildingTypeOptions.map((o) => [o.value, o.label]));

export function BuildingForm({ building }: { building?: Building }) {
  return building ? <EditBuildingForm building={building} /> : <CreateBuildingForm />;
}

function CreateBuildingForm() {
  const router = useRouter();
  const createMutation = useCreateBuilding();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBuildingFormInput, unknown, CreateBuildingFormValues>({
    resolver: zodResolver(createBuildingSchema),
  });

  async function onSubmit(values: CreateBuildingFormValues) {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Bâtiment créé.');
      router.push('/batiments');
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
      <div className="grid gap-1.5">
        <Label htmlFor="building-name">Nom</Label>
        <Input id="building-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="building-type">Type</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="building-type">
                <SelectValue placeholder="Sélectionner…">
                  {(value: string) => (value ? (typeLabelByValue.get(value) ?? value) : 'Sélectionner…')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {buildingTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.type ? <p className="text-sm text-destructive">{errors.type.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="building-capacity">Capacité (optionnel)</Label>
        <Input id="building-capacity" type="number" {...register('capacity')} />
        {errors.capacity ? (
          <p className="text-sm text-destructive">{errors.capacity.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le bâtiment'}
      </Button>
    </form>
  );
}

function EditBuildingForm({ building }: { building: Building }) {
  const router = useRouter();
  const updateMutation = useUpdateBuilding(building.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBuildingFormInput, unknown, UpdateBuildingFormValues>({
    resolver: zodResolver(updateBuildingSchema),
    defaultValues: {
      name: building.name,
      type: building.type,
      capacity: building.capacity ?? undefined,
    },
  });

  async function onSubmit(values: UpdateBuildingFormValues) {
    try {
      await updateMutation.mutateAsync(values);
      toast.success('Bâtiment modifié.');
      router.push(`/batiments/${building.id}`);
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
      <div className="grid gap-1.5">
        <Label htmlFor="building-name">Nom</Label>
        <Input id="building-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="building-type">Type</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="building-type">
                <SelectValue placeholder="Sélectionner…">
                  {(value: string) => (value ? (typeLabelByValue.get(value) ?? value) : 'Sélectionner…')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {buildingTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.type ? <p className="text-sm text-destructive">{errors.type.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="building-capacity">Capacité (optionnel)</Label>
        <Input id="building-capacity" type="number" {...register('capacity')} />
        {errors.capacity ? (
          <p className="text-sm text-destructive">{errors.capacity.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
