'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { BroilerDailyRecord, UpdateDailyRecordInput } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useItems } from '@/features/items/hooks';
import { useUpdateDailyRecord } from '../hooks';
import {
  updateDailyRecordSchema,
  type UpdateDailyRecordFormInput,
  type UpdateDailyRecordFormValues,
} from '../schemas';

const behaviorFields = [
  { name: 'behaviorNormal', label: 'Normal' },
  { name: 'behaviorLowConsumption', label: 'Faible consommation' },
  { name: 'behaviorAgitation', label: 'Agitation' },
  { name: 'behaviorFlocking', label: 'Regroupement' },
  { name: 'behaviorLethargy', label: 'Abattement' },
  { name: 'behaviorDiarrhea', label: 'Diarrhée' },
  { name: 'behaviorRespiratoryDistress', label: 'Difficultés respiratoires' },
] as const;

function recordToDefaults(record: BroilerDailyRecord): UpdateDailyRecordFormInput {
  return {
    entryTime: record.entryTime ?? '',
    mortalityQuantity: record.mortalityQuantity,
    cullsQuantity: record.cullsQuantity,
    otherExitsQuantity: record.otherExitsQuantity,
    feedType: record.feedType ?? '',
    feedDistributedKg: record.feedDistributedKg ?? undefined,
    feedRemainingKg: record.feedRemainingKg ?? undefined,
    feedBagsUsed: record.feedBagsUsed ?? undefined,
    feedItemId: record.feedItemId ?? '',
    waterConsumptionLiters: record.waterConsumptionLiters ?? undefined,
    waterObservation: record.waterObservation ?? '',
    sampleSize: record.sampleSize ?? undefined,
    totalSampleWeightG: record.totalSampleWeightG ?? undefined,
    temperatureMinC: record.temperatureMinC ?? undefined,
    temperatureMaxC: record.temperatureMaxC ?? undefined,
    temperatureNowC: record.temperatureNowC ?? undefined,
    humidityPercent: record.humidityPercent ?? undefined,
    symptoms: record.symptoms ?? '',
    treatment: record.treatment ?? '',
    vaccination: record.vaccination ?? '',
    healthProduct: record.healthProduct ?? '',
    healthQuantity: record.healthQuantity ?? '',
    healthResponsible: record.healthResponsible ?? '',
    behaviorNormal: record.behaviorNormal,
    behaviorLowConsumption: record.behaviorLowConsumption,
    behaviorAgitation: record.behaviorAgitation,
    behaviorFlocking: record.behaviorFlocking,
    behaviorLethargy: record.behaviorLethargy,
    behaviorDiarrhea: record.behaviorDiarrhea,
    behaviorRespiratoryDistress: record.behaviorRespiratoryDistress,
    behaviorOther: record.behaviorOther ?? '',
    observations: record.observations ?? '',
  };
}

export function DailyRecordForm({ batchId, record }: { batchId: string; record: BroilerDailyRecord }) {
  const router = useRouter();
  const { data: items } = useItems({ category: 'aliments' });
  const itemsById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const updateMutation = useUpdateDailyRecord(batchId, record.dayNumber);
  const {
    register,
    control,
    watch,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateDailyRecordFormInput, unknown, UpdateDailyRecordFormValues>({
    resolver: zodResolver(updateDailyRecordSchema),
    defaultValues: recordToDefaults(record),
  });

  // La ligne change quand on navigue directement d'un jour à l'autre
  // (même vue montée, seul `record` change) — resynchroniser le formulaire.
  useEffect(() => {
    reset(recordToDefaults(record));
  }, [record, reset]);

  const feedItemId = watch('feedItemId');

  async function onSubmit(values: UpdateDailyRecordFormValues) {
    try {
      const input: UpdateDailyRecordInput = {
        ...values,
        entryTime: values.entryTime || undefined,
        feedType: values.feedType || undefined,
        // Mapping explicite ''→null : un item retiré doit déclencher le
        // retour de stock côté serveur, `undefined` serait ignoré (voir
        // schemas.ts et DETTE_TECHNIQUE.md).
        feedItemId: values.feedItemId === '' ? null : values.feedItemId,
        waterObservation: values.waterObservation || undefined,
        symptoms: values.symptoms || undefined,
        treatment: values.treatment || undefined,
        vaccination: values.vaccination || undefined,
        healthProduct: values.healthProduct || undefined,
        healthQuantity: values.healthQuantity || undefined,
        healthResponsible: values.healthResponsible || undefined,
        behaviorOther: values.behaviorOther || undefined,
        observations: values.observations || undefined,
      };
      await updateMutation.mutateAsync(input);
      toast.success(`Jour ${record.dayNumber} enregistré.`);
      router.push(`/poulets-chair/${batchId}`);
    } catch {
      toast.error('Échec de l’enregistrement.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Effectif</h2>
        <div className="grid grid-cols-3 gap-4">
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
        <div className="grid gap-1.5">
          <Label htmlFor="dr-entry-time">Heure de saisie</Label>
          <Input id="dr-entry-time" type="time" {...register('entryTime')} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Alimentation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-feed-type">Type d’aliment</Label>
            <Input id="dr-feed-type" {...register('feedType')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-feed-item">Article de stock (optionnel)</Label>
            <Controller
              name="feedItemId"
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
            {feedItemId ? (
              <p className="text-xs text-muted-foreground">
                Une correction de la quantité distribuée déclenche un mouvement de stock pour cet
                article.
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-feed-distributed">Distribué (kg)</Label>
            <Input id="dr-feed-distributed" type="number" step="0.01" {...register('feedDistributedKg')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-feed-remaining">Restant (kg)</Label>
            <Input id="dr-feed-remaining" type="number" step="0.01" {...register('feedRemainingKg')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-feed-bags">Sacs utilisés</Label>
            <Input id="dr-feed-bags" type="number" {...register('feedBagsUsed')} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Eau</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-water">Consommation (litres)</Label>
          <Input id="dr-water" type="number" step="0.01" {...register('waterConsumptionLiters')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-water-obs">Observation eau</Label>
          <Textarea id="dr-water-obs" {...register('waterObservation')} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Croissance</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-sample-size">Effectif pesé</Label>
            <Input id="dr-sample-size" type="number" {...register('sampleSize')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-sample-weight">Poids total échantillon (g)</Label>
            <Input id="dr-sample-weight" type="number" {...register('totalSampleWeightG')} />
          </div>
        </div>
        {record.averageWeightG !== null ? (
          <p className="text-sm text-muted-foreground">
            Poids moyen calculé côté serveur : {record.averageWeightG} g.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Environnement</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-temp-min">Temp. min (°C)</Label>
            <Input id="dr-temp-min" type="number" step="0.1" {...register('temperatureMinC')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-temp-max">Temp. max (°C)</Label>
            <Input id="dr-temp-max" type="number" step="0.1" {...register('temperatureMaxC')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-temp-now">Temp. actuelle (°C)</Label>
            <Input id="dr-temp-now" type="number" step="0.1" {...register('temperatureNowC')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-humidity">Humidité (%)</Label>
            <Input id="dr-humidity" type="number" step="0.1" {...register('humidityPercent')} />
            {errors.humidityPercent ? (
              <p className="text-sm text-destructive">{errors.humidityPercent.message}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Santé</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-symptoms">Symptômes</Label>
          <Textarea id="dr-symptoms" {...register('symptoms')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-treatment">Traitement</Label>
          <Textarea id="dr-treatment" {...register('treatment')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-vaccination">Vaccination</Label>
            <Input id="dr-vaccination" {...register('vaccination')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-health-product">Produit</Label>
            <Input id="dr-health-product" {...register('healthProduct')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dr-health-quantity">Quantité</Label>
            <Input id="dr-health-quantity" {...register('healthQuantity')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dr-health-responsible">Responsable</Label>
            <Input id="dr-health-responsible" {...register('healthResponsible')} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-primary">Comportement</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {behaviorFields.map(({ name, label }) => (
            <Controller
              key={name}
              name={name}
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  {label}
                </label>
              )}
            />
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr-behavior-other">Autre comportement</Label>
          <Input id="dr-behavior-other" {...register('behaviorOther')} />
        </div>
      </section>

      <div className="grid gap-1.5">
        <Label htmlFor="dr-observations">Observations</Label>
        <Textarea id="dr-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : `Enregistrer le jour ${record.dayNumber}`}
      </Button>
    </form>
  );
}
