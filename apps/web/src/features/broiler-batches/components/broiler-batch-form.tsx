'use client';

import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { BroilerBatchWithComputed } from '@dondy-elevage/shared-types';
import { BROILER_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockSelect, BuildingSelect, UserSelect } from '@/components/shared/entity-select';
import { useSuppliers } from '@/features/suppliers/hooks';
import { useCreateBroilerBatch, useUpdateBroilerBatch } from '../hooks';
import {
  broilerOriginOptions,
  createBroilerBatchSchema,
  updateBroilerBatchSchema,
  type CreateBroilerBatchFormInput,
  type CreateBroilerBatchFormValues,
  type UpdateBroilerBatchFormInput,
  type UpdateBroilerBatchFormValues,
} from '../schemas';

const originLabels: Record<(typeof broilerOriginOptions)[number], string> = {
  ACHAT: 'Achat',
  NAISSANCE_INTERNE: 'Naissance interne',
};

const statusLabels: Record<(typeof BROILER_BATCH_EDITABLE_STATUSES)[number], string> = {
  BROUILLON: 'Brouillon',
  PLANIFIEE: 'Planifiée',
  EN_DEMARRAGE: 'En démarrage',
  EN_CROISSANCE: 'En croissance',
  EN_FINITION: 'En finition',
  PRETE_A_VENDRE: 'Prête à vendre',
  EN_VENTE: 'En vente',
  VENDUE: 'Vendue',
};

/** origin=ACHAT affiche le select fournisseur — masqué (pas seulement
 * désactivé) si le rôle courant n'a pas SUPPLIERS_READ (403 gracieux, voir
 * features/suppliers/hooks.ts) : un select vide serait trompeur, un
 * message explicite vaut mieux. */
function SupplierField<T extends FieldValues>({
  name,
  control,
  error,
}: {
  name: Path<T>;
  control: Control<T>;
  error?: string;
}) {
  const { data: suppliers, isError } = useSuppliers();
  const suppliersById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Sélection du fournisseur non disponible avec votre rôle actuel — laissez ce champ à un
        administrateur si nécessaire.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>Fournisseur</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (suppliersById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
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

export function BroilerBatchForm({ batch }: { batch?: BroilerBatchWithComputed }) {
  return batch ? <EditBroilerBatchForm batch={batch} /> : <CreateBroilerBatchForm />;
}

function CreateBroilerBatchForm() {
  const router = useRouter();
  const createMutation = useCreateBroilerBatch();
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBroilerBatchFormInput, unknown, CreateBroilerBatchFormValues>({
    resolver: zodResolver(createBroilerBatchSchema),
    // buildingId/primaryManagerId initialisés à '' : sans valeur par
    // défaut, le Select démarre non contrôlé (field.value===undefined)
    // puis devient contrôlé dès la première sélection — base-ui avertit
    // (et React déconseille) ce changement de mode en cours de vie du
    // composant. Trouvé en vérification manuelle Phase 12 (même défaut
    // reproduit sur le formulaire Pondeuses, corrigé au même endroit).
    defaultValues: {
      origin: 'NAISSANCE_INTERNE',
      deadOnArrivalQuantity: 0,
      buildingId: '',
      blockId: '',
      primaryManagerId: '',
    },
  });
  const origin = watch('origin');
  const buildingId = watch('buildingId');

  async function onSubmit(values: CreateBroilerBatchFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        arrivalTime: values.arrivalTime || undefined,
        breed: values.breed || undefined,
        supplierId: values.supplierId || undefined,
        invoiceNumber: values.invoiceNumber || undefined,
        blockId: values.blockId || undefined,
        plannedSaleDate: values.plannedSaleDate || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Bande créée.');
      router.push(`/poulets-chair/${created.id}`);
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
          <Label htmlFor="bb-arrival-date">Date d’arrivée</Label>
          <Input id="bb-arrival-date" type="date" {...register('arrivalDate')} />
          {errors.arrivalDate ? (
            <p className="text-sm text-destructive">{errors.arrivalDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-arrival-time">Heure d’arrivée</Label>
          <Input id="bb-arrival-time" type="time" {...register('arrivalTime')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bb-breed">Souche</Label>
        <Input id="bb-breed" {...register('breed')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bb-origin">Origine</Label>
        <Controller
          name="origin"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="bb-origin">
                <SelectValue>{(value: (typeof broilerOriginOptions)[number]) => originLabels[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {broilerOriginOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {originLabels[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {origin === 'ACHAT' ? (
        <>
          <SupplierField
            name="supplierId"
            control={control}
            error={errors.supplierId?.message}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="bb-invoice">N° de facture</Label>
            <Input id="bb-invoice" {...register('invoiceNumber')} />
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-ordered">Quantité commandée</Label>
          <Input id="bb-ordered" type="number" {...register('orderedQuantity')} />
          {errors.orderedQuantity ? (
            <p className="text-sm text-destructive">{errors.orderedQuantity.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-received">Quantité reçue</Label>
          <Input id="bb-received" type="number" {...register('receivedQuantity')} />
          {errors.receivedQuantity ? (
            <p className="text-sm text-destructive">{errors.receivedQuantity.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-doa">Morts à l’arrivée</Label>
          <Input id="bb-doa" type="number" {...register('deadOnArrivalQuantity')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-unit-price">Prix unitaire (FCFA)</Label>
          <Input id="bb-unit-price" type="number" {...register('unitPriceFcfa')} />
          {errors.unitPriceFcfa ? (
            <p className="text-sm text-destructive">{errors.unitPriceFcfa.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-transport">Transport (FCFA)</Label>
          <Input id="bb-transport" type="number" {...register('transportCostFcfa')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-other-costs">Autres coûts (FCFA)</Label>
          <Input id="bb-other-costs" type="number" {...register('otherCostsFcfa')} />
        </div>
      </div>

      <BuildingSelect
        name="buildingId"
        control={control}
        error={errors.buildingId?.message}
      />
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
        <Label htmlFor="bb-planned-sale">Date de vente prévue</Label>
        <Input id="bb-planned-sale" type="date" {...register('plannedSaleDate')} />
        <p className="text-xs text-muted-foreground">
          Laissé vide : calculé automatiquement (arrivée + 44 jours).
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bb-observations">Observations</Label>
        <Textarea id="bb-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer la bande'}
      </Button>
    </form>
  );
}

function EditBroilerBatchForm({ batch }: { batch: BroilerBatchWithComputed }) {
  const router = useRouter();
  const updateMutation = useUpdateBroilerBatch(batch.id);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBroilerBatchFormInput, unknown, UpdateBroilerBatchFormValues>({
    resolver: zodResolver(updateBroilerBatchSchema),
    defaultValues: {
      arrivalDate: batch.arrivalDate.slice(0, 10),
      arrivalTime: batch.arrivalTime ?? '',
      breed: batch.breed ?? '',
      origin: batch.origin,
      supplierId: batch.supplierId ?? '',
      invoiceNumber: batch.invoiceNumber ?? '',
      orderedQuantity: batch.orderedQuantity,
      receivedQuantity: batch.receivedQuantity,
      deadOnArrivalQuantity: batch.deadOnArrivalQuantity,
      unitPriceFcfa: batch.unitPriceFcfa,
      transportCostFcfa: batch.transportCostFcfa,
      otherCostsFcfa: batch.otherCostsFcfa,
      buildingId: batch.buildingId,
      blockId: batch.blockId ?? '',
      primaryManagerId: batch.primaryManagerId,
      plannedSaleDate: batch.plannedSaleDate.slice(0, 10),
      observations: batch.observations ?? '',
      status: batch.status as (typeof BROILER_BATCH_EDITABLE_STATUSES)[number],
    },
  });
  const origin = watch('origin');
  const buildingId = watch('buildingId');

  async function onSubmit(values: UpdateBroilerBatchFormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        arrivalTime: values.arrivalTime || undefined,
        breed: values.breed || undefined,
        supplierId: values.supplierId || undefined,
        invoiceNumber: values.invoiceNumber || undefined,
        // '' -> null explicite (pas undefined) : un champ vidé dans le
        // Select doit effacer le bloc en base, pas être ignoré par le PATCH
        // partiel (voir UpdateBroilerBatchDto.blockId, `null` accepté).
        blockId: values.blockId || null,
        plannedSaleDate: values.plannedSaleDate || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Bande modifiée.');
      router.push(`/poulets-chair/${batch.id}`);
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
          <Label htmlFor="bb-arrival-date">Date d’arrivée</Label>
          <Input id="bb-arrival-date" type="date" {...register('arrivalDate')} />
          {errors.arrivalDate ? (
            <p className="text-sm text-destructive">{errors.arrivalDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-arrival-time">Heure d’arrivée</Label>
          <Input id="bb-arrival-time" type="time" {...register('arrivalTime')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bb-breed">Souche</Label>
        <Input id="bb-breed" {...register('breed')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bb-origin">Origine</Label>
        <Controller
          name="origin"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="bb-origin">
                <SelectValue>{(value: (typeof broilerOriginOptions)[number]) => originLabels[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {broilerOriginOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {originLabels[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {origin === 'ACHAT' ? (
        <>
          <SupplierField
            name="supplierId"
            control={control}
            error={errors.supplierId?.message}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="bb-invoice">N° de facture</Label>
            <Input id="bb-invoice" {...register('invoiceNumber')} />
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-ordered">Quantité commandée</Label>
          <Input id="bb-ordered" type="number" {...register('orderedQuantity')} />
          {errors.orderedQuantity ? (
            <p className="text-sm text-destructive">{errors.orderedQuantity.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-received">Quantité reçue</Label>
          <Input id="bb-received" type="number" {...register('receivedQuantity')} />
          {errors.receivedQuantity ? (
            <p className="text-sm text-destructive">{errors.receivedQuantity.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-doa">Morts à l’arrivée</Label>
          <Input id="bb-doa" type="number" {...register('deadOnArrivalQuantity')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bb-unit-price">Prix unitaire (FCFA)</Label>
          <Input id="bb-unit-price" type="number" {...register('unitPriceFcfa')} />
          {errors.unitPriceFcfa ? (
            <p className="text-sm text-destructive">{errors.unitPriceFcfa.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-transport">Transport (FCFA)</Label>
          <Input id="bb-transport" type="number" {...register('transportCostFcfa')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bb-other-costs">Autres coûts (FCFA)</Label>
          <Input id="bb-other-costs" type="number" {...register('otherCostsFcfa')} />
        </div>
      </div>

      <BuildingSelect
        name="buildingId"
        control={control}
        error={errors.buildingId?.message}
      />
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
        <Label htmlFor="bb-planned-sale">Date de vente prévue</Label>
        <Input id="bb-planned-sale" type="date" {...register('plannedSaleDate')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bb-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="bb-status">
                <SelectValue>
                  {(value: (typeof BROILER_BATCH_EDITABLE_STATUSES)[number]) => statusLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BROILER_BATCH_EDITABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Annulation et clôture se font depuis des actions dédiées sur la fiche de la bande.
        </p>
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
