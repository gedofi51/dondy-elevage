'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type {
  BreederDailyRecord,
  CreateBreederDailyRecordInput,
  UpdateBreederDailyRecordInput,
} from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreateBreederDailyRecord, useUpdateBreederDailyRecord } from '../hooks';
import {
  createBreederDailyRecordSchema,
  updateBreederDailyRecordSchema,
  type CreateBreederDailyRecordFormInput,
  type CreateBreederDailyRecordFormValues,
  type UpdateBreederDailyRecordFormInput,
  type UpdateBreederDailyRecordFormValues,
} from '../schemas';

function recordToDefaults(record: BreederDailyRecord): UpdateBreederDailyRecordFormInput {
  return {
    eggsLaid: record.eggsLaid,
    eggsSelectedForIncubation: record.eggsSelectedForIncubation,
    eggsRejected: record.eggsRejected,
    eggsSold: record.eggsSold,
    observations: record.observations ?? '',
  };
}

interface DailyRecordFormProps {
  batchId: string;
  date: string;
  existing: BreederDailyRecord | null;
}

export function DailyRecordForm({ batchId, date, existing }: DailyRecordFormProps) {
  return existing ? (
    <EditDailyRecordForm batchId={batchId} date={date} record={existing} />
  ) : (
    <CreateDailyRecordForm batchId={batchId} date={date} />
  );
}

function CreateDailyRecordForm({ batchId, date }: { batchId: string; date: string }) {
  const router = useRouter();
  const createMutation = useCreateBreederDailyRecord(batchId, date);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBreederDailyRecordFormInput, unknown, CreateBreederDailyRecordFormValues>({
    resolver: zodResolver(createBreederDailyRecordSchema),
    defaultValues: { eggsSelectedForIncubation: 0, eggsRejected: 0, eggsSold: 0 },
  });

  async function onSubmit(values: CreateBreederDailyRecordFormValues) {
    try {
      const input: CreateBreederDailyRecordInput = {
        ...values,
        date,
        observations: values.observations || undefined,
      };
      await createMutation.mutateAsync(input);
      toast.success('Journée de production enregistrée.');
      router.push(`/reproducteurs/${batchId}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <p className="text-sm text-muted-foreground">
        Aucune journée saisie pour le {new Date(date).toLocaleDateString('fr-FR')}.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-laid">Œufs pondus</Label>
          <Input id="dr-eggs-laid" type="number" {...register('eggsLaid')} />
          {errors.eggsLaid ? <p className="text-sm text-destructive">{errors.eggsLaid.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-selected">Sélectionnés pour incubation</Label>
          <Input id="dr-eggs-selected" type="number" {...register('eggsSelectedForIncubation')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-rejected">Œufs rejetés</Label>
          <Input id="dr-eggs-rejected" type="number" {...register('eggsRejected')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-sold">Œufs vendus</Label>
          <Input id="dr-eggs-sold" type="number" {...register('eggsSold')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="dr-observations">Observations</Label>
        <Textarea id="dr-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer la journée'}
      </Button>
    </form>
  );
}

function EditDailyRecordForm({
  batchId,
  date,
  record,
}: {
  batchId: string;
  date: string;
  record: BreederDailyRecord;
}) {
  const router = useRouter();
  const updateMutation = useUpdateBreederDailyRecord(batchId, date);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UpdateBreederDailyRecordFormInput, unknown, UpdateBreederDailyRecordFormValues>({
    resolver: zodResolver(updateBreederDailyRecordSchema),
    defaultValues: recordToDefaults(record),
  });

  async function onSubmit(values: UpdateBreederDailyRecordFormValues) {
    try {
      const input: UpdateBreederDailyRecordInput = {
        ...values,
        observations: values.observations || undefined,
      };
      await updateMutation.mutateAsync(input);
      toast.success('Journée de production modifiée.');
      router.push(`/reproducteurs/${batchId}`);
    } catch (err) {
      // 409 possible si eggsSelectedForIncubation réduit sous ce qui est
      // déjà consommé par un lot d'incubation — message serveur exact.
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <p className="text-sm text-muted-foreground">
        Correction de la journée du {new Date(record.date).toLocaleDateString('fr-FR')}.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-laid">Œufs pondus</Label>
          <Input id="dr-eggs-laid" type="number" {...register('eggsLaid')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-selected">Sélectionnés pour incubation</Label>
          <Input id="dr-eggs-selected" type="number" {...register('eggsSelectedForIncubation')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-rejected">Œufs rejetés</Label>
          <Input id="dr-eggs-rejected" type="number" {...register('eggsRejected')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-eggs-sold">Œufs vendus</Label>
          <Input id="dr-eggs-sold" type="number" {...register('eggsSold')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="dr-observations">Observations</Label>
        <Textarea id="dr-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
