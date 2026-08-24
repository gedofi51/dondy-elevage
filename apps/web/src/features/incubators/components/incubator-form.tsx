'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { Incubator } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateIncubator, useUpdateIncubator } from '../hooks';
import {
  createIncubatorSchema,
  updateIncubatorSchema,
  type CreateIncubatorFormInput,
  type CreateIncubatorFormValues,
  type UpdateIncubatorFormInput,
  type UpdateIncubatorFormValues,
} from '../schemas';

export function IncubatorForm({ incubator }: { incubator?: Incubator }) {
  return incubator ? <EditIncubatorForm incubator={incubator} /> : <CreateIncubatorForm />;
}

function CreateIncubatorForm() {
  const router = useRouter();
  const createMutation = useCreateIncubator();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateIncubatorFormInput, unknown, CreateIncubatorFormValues>({
    resolver: zodResolver(createIncubatorSchema),
  });

  async function onSubmit(values: CreateIncubatorFormValues) {
    try {
      await createMutation.mutateAsync({ ...values, notes: values.notes || undefined });
      toast.success('Couveuse créée.');
      router.push('/couveuses');
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
        <Label htmlFor="inc-name">Nom</Label>
        <Input id="inc-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inc-capacity">Capacité (œufs)</Label>
        <Input id="inc-capacity" type="number" {...register('capacityEggs')} />
        {errors.capacityEggs ? (
          <p className="text-sm text-destructive">{errors.capacityEggs.message}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inc-notes">Notes</Label>
        <Textarea id="inc-notes" {...register('notes')} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer la couveuse'}
      </Button>
    </form>
  );
}

function EditIncubatorForm({ incubator }: { incubator: Incubator }) {
  const router = useRouter();
  const updateMutation = useUpdateIncubator(incubator.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateIncubatorFormInput, unknown, UpdateIncubatorFormValues>({
    resolver: zodResolver(updateIncubatorSchema),
    defaultValues: {
      name: incubator.name,
      capacityEggs: incubator.capacityEggs ?? undefined,
      notes: incubator.notes ?? '',
    },
  });

  async function onSubmit(values: UpdateIncubatorFormValues) {
    try {
      await updateMutation.mutateAsync({ ...values, notes: values.notes || undefined });
      toast.success('Couveuse modifiée.');
      router.push('/couveuses');
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
        <Label htmlFor="inc-name">Nom</Label>
        <Input id="inc-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inc-capacity">Capacité (œufs)</Label>
        <Input id="inc-capacity" type="number" {...register('capacityEggs')} />
        {errors.capacityEggs ? (
          <p className="text-sm text-destructive">{errors.capacityEggs.message}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inc-notes">Notes</Label>
        <Textarea id="inc-notes" {...register('notes')} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
