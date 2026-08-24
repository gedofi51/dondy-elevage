'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { IncubationBatchWithComputed } from '@dondy-elevage/shared-types';
import { INCUBATION_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BreederBatchSelect, IncubatorSelect } from '@/components/shared/entity-select';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useCreateIncubationBatch, useUpdateIncubationBatch } from '../hooks';
import {
  createIncubationBatchSchema,
  updateIncubationBatchSchema,
  type CreateIncubationBatchFormInput,
  type CreateIncubationBatchFormValues,
  type UpdateIncubationBatchFormInput,
  type UpdateIncubationBatchFormValues,
} from '../schemas';

const statusLabels: Record<(typeof INCUBATION_BATCH_EDITABLE_STATUSES)[number], string> = {
  EN_INCUBATION: 'En incubation',
  ECLOS: 'Éclos',
};

export function IncubationBatchForm({ batch }: { batch?: IncubationBatchWithComputed }) {
  return batch ? <EditIncubationBatchForm batch={batch} /> : <CreateIncubationBatchForm />;
}

function CreateIncubationBatchForm() {
  const router = useRouter();
  const createMutation = useCreateIncubationBatch();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateIncubationBatchFormInput, unknown, CreateIncubationBatchFormValues>({
    resolver: zodResolver(createIncubationBatchSchema),
    // breederBatchId/incubatorId initialisés à '' : sans valeur par défaut,
    // le Select démarre non contrôlé puis devient contrôlé dès la première
    // sélection — warning base-ui (voir DETTE_TECHNIQUE.md Phase 12).
    defaultValues: { breederBatchId: '', incubatorId: '' },
  });

  async function onSubmit(values: CreateIncubationBatchFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        remarks: values.remarks || undefined,
      });
      toast.success('Lot d’incubation créé.');
      router.push(`/couvoir/${created.id}`);
    } catch (err) {
      // 409 si eggCount > œufs fécondés disponibles du lot reproducteur —
      // message serveur exact, plus utile que le générique.
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création — vérifiez les champs.')
          : 'Échec de la création — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <BreederBatchSelect name="breederBatchId" control={control} error={errors.breederBatchId?.message} />
      <IncubatorSelect name="incubatorId" control={control} error={errors.incubatorId?.message} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="ib-start-date">Date de mise en incubation</Label>
          <Input id="ib-start-date" type="date" {...register('incubationStartDate')} />
          {errors.incubationStartDate ? (
            <p className="text-sm text-destructive">{errors.incubationStartDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ib-egg-count">Œufs mis en incubation</Label>
          <Input id="ib-egg-count" type="number" {...register('eggCount')} />
          {errors.eggCount ? <p className="text-sm text-destructive">{errors.eggCount.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ib-remarks">Remarques</Label>
        <Textarea id="ib-remarks" {...register('remarks')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le lot d’incubation'}
      </Button>
    </form>
  );
}

function EditIncubationBatchForm({ batch }: { batch: IncubationBatchWithComputed }) {
  const router = useRouter();
  const updateMutation = useUpdateIncubationBatch(batch.id);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateIncubationBatchFormInput, unknown, UpdateIncubationBatchFormValues>({
    resolver: zodResolver(updateIncubationBatchSchema),
    defaultValues: {
      incubatorId: batch.incubatorId,
      incubationStartDate: batch.incubationStartDate.slice(0, 10),
      remarks: batch.remarks ?? '',
      status: batch.status as (typeof INCUBATION_BATCH_EDITABLE_STATUSES)[number],
      actualHatchDate: batch.actualHatchDate?.slice(0, 10) ?? '',
      eggsInfertile: batch.eggsInfertile ?? undefined,
      eggsInfected: batch.eggsInfected ?? undefined,
      embryonicMortality: batch.embryonicMortality ?? undefined,
      chicksHatched: batch.chicksHatched ?? undefined,
    },
  });

  const eggsInfertile = Number(watch('eggsInfertile')) || 0;
  const eggsInfected = Number(watch('eggsInfected')) || 0;
  const embryonicMortality = Number(watch('embryonicMortality')) || 0;
  const chicksHatched = Number(watch('chicksHatched')) || 0;
  const bilanSum = eggsInfertile + eggsInfected + embryonicMortality + chicksHatched;
  const bilanTouched =
    watch('eggsInfertile') !== undefined ||
    watch('eggsInfected') !== undefined ||
    watch('embryonicMortality') !== undefined ||
    watch('chicksHatched') !== undefined;

  async function onSubmit(values: UpdateIncubationBatchFormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        remarks: values.remarks || undefined,
        actualHatchDate: values.actualHatchDate || undefined,
      });
      toast.success('Lot d’incubation modifié.');
      router.push(`/couvoir/${batch.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement — vérifiez les champs.')
          : 'Échec de l’enregistrement — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <p className="text-sm text-muted-foreground">
        {batch.code} · lot reproducteur figé à la création · {batch.eggCount.toLocaleString('fr-FR')} œufs
        mis en incubation.
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Suivi couveuse</h2>
        <IncubatorSelect name="incubatorId" control={control} error={errors.incubatorId?.message} />
        <div className="grid gap-1.5">
          <Label htmlFor="ib-start-date">Date de mise en incubation</Label>
          <Input id="ib-start-date" type="date" {...register('incubationStartDate')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ib-status">Statut</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ib-status">
                  <SelectValue>
                    {(value: (typeof INCUBATION_BATCH_EDITABLE_STATUSES)[number]) => statusLabels[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INCUBATION_BATCH_EDITABLE_STATUSES.map((status) => (
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
          <Label htmlFor="ib-remarks">Remarques</Label>
          <Textarea id="ib-remarks" {...register('remarks')} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Bilan mirage-éclosion</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="ib-hatch-date">Date réelle d’éclosion</Label>
          <Input id="ib-hatch-date" type="date" {...register('actualHatchDate')} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ib-infertile">Non fécondés</Label>
            <Input id="ib-infertile" type="number" {...register('eggsInfertile')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ib-infected">Infectés</Label>
            <Input id="ib-infected" type="number" {...register('eggsInfected')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ib-embryonic">Mortalité embryonnaire</Label>
            <Input id="ib-embryonic" type="number" {...register('embryonicMortality')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ib-hatched">Poussins éclos</Label>
            <Input id="ib-hatched" type="number" {...register('chicksHatched')} />
          </div>
        </div>
        {bilanTouched ? (
          <p
            className={
              bilanSum === batch.eggCount ? 'text-sm text-muted-foreground' : 'text-sm text-warning'
            }
          >
            Somme du bilan : {bilanSum.toLocaleString('fr-FR')} / {batch.eggCount.toLocaleString('fr-FR')}{' '}
            œufs incubés
            {bilanSum !== batch.eggCount ? ' — vérifiez la cohérence avant d’enregistrer.' : ''}
          </p>
        ) : null}
      </section>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
