'use client';

import { useRouter } from 'next/navigation';
import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type {
  CreateLayerDailyRecordInput,
  LayerDailyRecord,
  UpdateLayerDailyRecordInput,
} from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useItems } from '@/features/items/hooks';
import { useCreateLayerDailyRecord, useUpdateLayerDailyRecord } from '../hooks';
import {
  createLayerDailyRecordSchema,
  updateLayerDailyRecordSchema,
  type CreateLayerDailyRecordFormInput,
  type CreateLayerDailyRecordFormValues,
  type UpdateLayerDailyRecordFormInput,
  type UpdateLayerDailyRecordFormValues,
} from '../schemas';

function recordToDefaults(record: LayerDailyRecord): UpdateLayerDailyRecordFormInput {
  return {
    feedItemId: record.feedItemId ?? '',
    henCount: record.henCount,
    mortalityQuantity: record.mortalityQuantity,
    cullsQuantity: record.cullsQuantity,
    otherExitsQuantity: record.otherExitsQuantity,
    eggsLaid: record.eggsLaid,
    eggsBroken: record.eggsBroken,
    eggsRejected: record.eggsRejected,
    feedDistributedKg: record.feedDistributedKg ?? undefined,
    observations: record.observations ?? '',
  };
}

interface DailyRecordFormProps {
  batchId: string;
  date: string;
  /** null = pas encore de ligne pour cette date (mode création) ; le
   * backend n'expose jamais la suggestion en lecture, elle est recalculée
   * côté client par l'appelant (voir daily-record-view.tsx) et passée ici
   * comme valeur par défaut modifiable. */
  existing: LayerDailyRecord | null;
  suggestedHenCount: number;
}

export function DailyRecordForm({ batchId, date, existing, suggestedHenCount }: DailyRecordFormProps) {
  return existing ? (
    <EditDailyRecordForm batchId={batchId} date={date} record={existing} />
  ) : (
    <CreateDailyRecordForm batchId={batchId} date={date} suggestedHenCount={suggestedHenCount} />
  );
}

function FeedItemField<T extends FieldValues & { feedItemId?: string | null }>({
  control,
  itemId,
}: {
  control: Control<T>;
  itemId: string | null | undefined;
}) {
  const { data: items } = useItems({ category: 'aliments' });
  const itemsById = new Map((items ?? []).map((i) => [i.id, i.name]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="dr-feed-item">Article de stock (optionnel)</Label>
      <Controller
        name={'feedItemId' as Path<T>}
        control={control}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger id="dr-feed-item">
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
      {itemId ? (
        <p className="text-xs text-muted-foreground">
          Un mouvement de stock est déclenché pour la quantité distribuée de cet article.
        </p>
      ) : null}
    </div>
  );
}

function CreateDailyRecordForm({
  batchId,
  date,
  suggestedHenCount,
}: {
  batchId: string;
  date: string;
  suggestedHenCount: number;
}) {
  const router = useRouter();
  const createMutation = useCreateLayerDailyRecord(batchId, date);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLayerDailyRecordFormInput, unknown, CreateLayerDailyRecordFormValues>({
    resolver: zodResolver(createLayerDailyRecordSchema),
    defaultValues: { henCount: Math.max(suggestedHenCount, 0), eggsBroken: 0, eggsRejected: 0 },
  });
  const feedItemId = watch('feedItemId');

  async function onSubmit(values: CreateLayerDailyRecordFormValues) {
    try {
      const input: CreateLayerDailyRecordInput = {
        ...values,
        date,
        feedItemId: values.feedItemId || undefined,
        observations: values.observations || undefined,
      };
      await createMutation.mutateAsync(input);
      toast.success('Journée de ponte enregistrée.');
      router.push(`/pondeuses/${batchId}`);
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
        Aucune journée saisie pour le {new Date(date).toLocaleDateString('fr-FR')} — effectif suggéré
        pré-rempli ({suggestedHenCount.toLocaleString('fr-FR')}), modifiable si un recomptage physique
        diffère.
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Effectif</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-hen-count">Effectif (poules)</Label>
            <Input id="dr-hen-count" type="number" {...register('henCount')} />
            {errors.henCount ? (
              <p className="text-sm text-destructive">{errors.henCount.message}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-mortality">Mortalité</Label>
            <Input id="dr-mortality" type="number" {...register('mortalityQuantity')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-culls">Réformes</Label>
            <Input id="dr-culls" type="number" {...register('cullsQuantity')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-other-exits">Autres sorties</Label>
            <Input id="dr-other-exits" type="number" {...register('otherExitsQuantity')} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Ponte</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-eggs-laid">Œufs pondus</Label>
            <Input id="dr-eggs-laid" type="number" {...register('eggsLaid')} />
            {errors.eggsLaid ? (
              <p className="text-sm text-destructive">{errors.eggsLaid.message}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-eggs-broken">Œufs cassés</Label>
            <Input id="dr-eggs-broken" type="number" {...register('eggsBroken')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-eggs-rejected">Œufs rejetés</Label>
            <Input id="dr-eggs-rejected" type="number" {...register('eggsRejected')} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Alimentation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-feed-distributed">Distribué (kg)</Label>
            <Input id="dr-feed-distributed" type="number" step="0.01" {...register('feedDistributedKg')} />
          </div>
          <FeedItemField control={control} itemId={feedItemId} />
        </div>
      </section>

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
  record: LayerDailyRecord;
}) {
  const router = useRouter();
  const updateMutation = useUpdateLayerDailyRecord(batchId, date);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UpdateLayerDailyRecordFormInput, unknown, UpdateLayerDailyRecordFormValues>({
    resolver: zodResolver(updateLayerDailyRecordSchema),
    defaultValues: recordToDefaults(record),
  });
  const feedItemId = watch('feedItemId');

  async function onSubmit(values: UpdateLayerDailyRecordFormValues) {
    try {
      const input: UpdateLayerDailyRecordInput = {
        ...values,
        // Mapping explicite ''→null : un item retiré doit déclencher le
        // retour de stock côté serveur, `undefined` serait ignoré.
        feedItemId: values.feedItemId === '' ? null : values.feedItemId,
        observations: values.observations || undefined,
      };
      await updateMutation.mutateAsync(input);
      toast.success('Journée de ponte modifiée.');
      router.push(`/pondeuses/${batchId}`);
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
        Correction de la journée du {new Date(record.date).toLocaleDateString('fr-FR')}.
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Effectif</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-hen-count">Effectif (poules)</Label>
            <Input id="dr-hen-count" type="number" {...register('henCount')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-mortality">Mortalité</Label>
            <Input id="dr-mortality" type="number" {...register('mortalityQuantity')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-culls">Réformes</Label>
            <Input id="dr-culls" type="number" {...register('cullsQuantity')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-other-exits">Autres sorties</Label>
            <Input id="dr-other-exits" type="number" {...register('otherExitsQuantity')} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Ponte</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-eggs-laid">Œufs pondus</Label>
            <Input id="dr-eggs-laid" type="number" {...register('eggsLaid')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-eggs-broken">Œufs cassés</Label>
            <Input id="dr-eggs-broken" type="number" {...register('eggsBroken')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-eggs-rejected">Œufs rejetés</Label>
            <Input id="dr-eggs-rejected" type="number" {...register('eggsRejected')} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Commercialisables (calculé) : {record.eggsSellable.toLocaleString('fr-FR')} · Taux de ponte
          (calculé) : {record.layingRatePercent ?? '—'} %
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Alimentation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-feed-distributed">Distribué (kg)</Label>
            <Input id="dr-feed-distributed" type="number" step="0.01" {...register('feedDistributedKg')} />
          </div>
          <FeedItemField control={control} itemId={feedItemId} />
        </div>
      </section>

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
