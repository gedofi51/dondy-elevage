'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { AssetWithComputed } from '@dondy-elevage/shared-types';
import { ASSET_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierSelect, UserSelect } from '@/components/shared/entity-select';
import { useCreateAsset, useUpdateAsset } from '../hooks';
import {
  assetCategoryLabels,
  assetCategoryOptions,
  createAssetSchema,
  updateAssetSchema,
  type CreateAssetFormInput,
  type CreateAssetFormValues,
  type UpdateAssetFormInput,
  type UpdateAssetFormValues,
} from '../schemas';

const statusLabels: Record<(typeof ASSET_EDITABLE_STATUSES)[number], string> = {
  ACTIF: 'Actif',
  HORS_SERVICE: 'Hors service',
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssetForm({ asset }: { asset?: AssetWithComputed }) {
  return asset ? <EditAssetForm asset={asset} /> : <CreateAssetForm />;
}

function CreateAssetForm() {
  const router = useRouter();
  const createMutation = useCreateAsset();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssetFormInput, unknown, CreateAssetFormValues>({
    resolver: zodResolver(createAssetSchema),
    // category/supplierId/responsibleId initialisés : Select contrôlé dès
    // le premier rendu (voir DETTE_TECHNIQUE.md Phase 12).
    defaultValues: {
      category: 'elevage',
      supplierId: '',
      responsibleId: '',
      purchaseDate: todayIsoDate(),
      serviceDate: todayIsoDate(),
      installationCostFcfa: 0,
      residualValueFcfa: 0,
    },
  });

  async function onSubmit(values: CreateAssetFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        brand: values.brand || undefined,
        model: values.model || undefined,
        serialNumber: values.serialNumber || undefined,
        supplierId: values.supplierId || undefined,
        location: values.location || undefined,
        warrantyExpiresAt: values.warrantyExpiresAt || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Actif créé.');
      router.push(`/patrimoine/${created.id}`);
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
          <Label htmlFor="asset-designation">Désignation</Label>
          <Input id="asset-designation" {...register('designation')} />
          {errors.designation ? (
            <p className="text-sm text-destructive">{errors.designation.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-category">Catégorie</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="asset-category">
                  <SelectValue>
                    {(value: (typeof assetCategoryOptions)[number]) => assetCategoryLabels[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assetCategoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {assetCategoryLabels[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="asset-brand">Marque</Label>
          <Input id="asset-brand" {...register('brand')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-model">Modèle</Label>
          <Input id="asset-model" {...register('model')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-serial">N° de série</Label>
          <Input id="asset-serial" {...register('serialNumber')} />
        </div>
      </div>

      <SupplierSelect name="supplierId" control={control} error={errors.supplierId?.message} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="asset-purchase-date">Date d’achat</Label>
          <Input id="asset-purchase-date" type="date" {...register('purchaseDate')} />
          {errors.purchaseDate ? (
            <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-service-date">Date de mise en service</Label>
          <Input id="asset-service-date" type="date" {...register('serviceDate')} />
          {errors.serviceDate ? (
            <p className="text-sm text-destructive">{errors.serviceDate.message}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Point de départ du plan d’amortissement — immuable après création.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="asset-purchase-price">Prix d’achat (FCFA)</Label>
          <Input id="asset-purchase-price" type="number" {...register('purchasePriceFcfa')} />
          {errors.purchasePriceFcfa ? (
            <p className="text-sm text-destructive">{errors.purchasePriceFcfa.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-installation-cost">Frais d’installation (FCFA)</Label>
          <Input id="asset-installation-cost" type="number" {...register('installationCostFcfa')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-residual-value">Valeur résiduelle (FCFA)</Label>
          <Input id="asset-residual-value" type="number" {...register('residualValueFcfa')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="asset-duration">Durée d’amortissement (années)</Label>
          <Input id="asset-duration" type="number" {...register('depreciationDurationYears')} />
          {errors.depreciationDurationYears ? (
            <p className="text-sm text-destructive">{errors.depreciationDurationYears.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-warranty">Garantie jusqu’au</Label>
          <Input id="asset-warranty" type="date" {...register('warrantyExpiresAt')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="asset-location">Localisation</Label>
        <Input id="asset-location" {...register('location')} />
      </div>

      <UserSelect
        name="responsibleId"
        label="Responsable"
        control={control}
        error={errors.responsibleId?.message}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="asset-observations">Observations</Label>
        <Textarea id="asset-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer l’actif'}
      </Button>
    </form>
  );
}

function EditAssetForm({ asset }: { asset: AssetWithComputed }) {
  const router = useRouter();
  const updateMutation = useUpdateAsset(asset.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateAssetFormInput, unknown, UpdateAssetFormValues>({
    resolver: zodResolver(updateAssetSchema),
    defaultValues: {
      designation: asset.designation,
      category: asset.category as (typeof assetCategoryOptions)[number],
      brand: asset.brand ?? '',
      model: asset.model ?? '',
      serialNumber: asset.serialNumber ?? '',
      supplierId: asset.supplierId ?? '',
      location: asset.location ?? '',
      responsibleId: asset.responsibleId,
      warrantyExpiresAt: asset.warrantyExpiresAt ? asset.warrantyExpiresAt.slice(0, 10) : '',
      observations: asset.observations ?? '',
      status: asset.status as (typeof ASSET_EDITABLE_STATUSES)[number],
    },
  });

  async function onSubmit(values: UpdateAssetFormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        brand: values.brand || undefined,
        model: values.model || undefined,
        serialNumber: values.serialNumber || undefined,
        supplierId: values.supplierId || undefined,
        location: values.location || undefined,
        warrantyExpiresAt: values.warrantyExpiresAt || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Actif modifié.');
      router.push(`/patrimoine/${asset.id}`);
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
          <Label htmlFor="asset-designation">Désignation</Label>
          <Input id="asset-designation" {...register('designation')} />
          {errors.designation ? (
            <p className="text-sm text-destructive">{errors.designation.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-category">Catégorie</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="asset-category">
                  <SelectValue>
                    {(value: (typeof assetCategoryOptions)[number]) => assetCategoryLabels[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assetCategoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {assetCategoryLabels[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="asset-brand">Marque</Label>
          <Input id="asset-brand" {...register('brand')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-model">Modèle</Label>
          <Input id="asset-model" {...register('model')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asset-serial">N° de série</Label>
          <Input id="asset-serial" {...register('serialNumber')} />
        </div>
      </div>

      <SupplierSelect name="supplierId" control={control} error={errors.supplierId?.message} />

      <div className="grid gap-1.5">
        <Label htmlFor="asset-location">Localisation</Label>
        <Input id="asset-location" {...register('location')} />
      </div>

      <UserSelect
        name="responsibleId"
        label="Responsable"
        control={control}
        error={errors.responsibleId?.message}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="asset-warranty">Garantie jusqu’au</Label>
        <Input id="asset-warranty" type="date" {...register('warrantyExpiresAt')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="asset-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="asset-status">
                <SelectValue>
                  {(value: (typeof ASSET_EDITABLE_STATUSES)[number]) => statusLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ASSET_EDITABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          La réforme se fait depuis une action dédiée sur la fiche de l’actif.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="asset-observations">Observations</Label>
        <Textarea id="asset-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
