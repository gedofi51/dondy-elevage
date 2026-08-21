'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { CreateSaleInput, SaleProductType } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomers } from '@/features/customers/hooks';
import { useCreateSale } from '../hooks';
import {
  createSaleSchema,
  saleModeOptions,
  type CreateSaleFormInput,
  type CreateSaleFormValues,
} from '../schemas';

const saleModeLabels: Record<(typeof saleModeOptions)[number], string> = {
  UNITE: 'À l’unité',
  POIDS: 'Au poids',
  LOT: 'Au lot',
};

type PresetFk =
  | { waterPointId: string }
  | { batchId: string }
  | { layerBatchId: string }
  | { chickBatchId: string };

interface SaleFormProps {
  productType: SaleProductType;
  presetFk: PresetFk;
  /** EAU est le seul type autorisant une vente comptoir sans client
   * (§7.4) — les autres types imposent customerId côté API. */
  customerRequired?: boolean;
  onSuccess?: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SaleForm({ productType, presetFk, customerRequired = false, onSuccess }: SaleFormProps) {
  const { data: customers } = useCustomers();
  const createMutation = useCreateSale();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateSaleFormInput, unknown, CreateSaleFormValues>({
    resolver: zodResolver(createSaleSchema),
    defaultValues: { date: todayIsoDate(), saleMode: 'UNITE', quantity: 1, discountFcfa: 0 },
  });

  async function onSubmit(values: CreateSaleFormValues) {
    try {
      const input: CreateSaleInput = {
        productType,
        ...presetFk,
        date: values.date,
        customerId: values.customerId || undefined,
        saleMode: values.saleMode,
        quantity: values.quantity,
        unitPriceFcfa: values.unitPriceFcfa,
        discountFcfa: values.discountFcfa,
        observation: values.observation || undefined,
        status: 'CONFIRMEE',
      };
      await createMutation.mutateAsync(input);
      toast.success('Vente enregistrée.');
      onSuccess?.();
    } catch {
      toast.error('Échec de l’enregistrement de la vente.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="sale-date">Date</Label>
        <Input id="sale-date" type="date" {...register('date')} />
        {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sale-customer">Client {customerRequired ? '' : '(optionnel — vente comptoir)'}</Label>
        <Controller
          name="customerId"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="sale-customer">
                <SelectValue placeholder={customerRequired ? 'Sélectionner…' : 'Vente comptoir'} />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sale-mode">Mode de vente</Label>
        <Controller
          name="saleMode"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="sale-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {saleModeOptions.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {saleModeLabels[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sale-quantity">Quantité</Label>
          <Input id="sale-quantity" type="number" {...register('quantity')} />
          {errors.quantity ? <p className="text-sm text-destructive">{errors.quantity.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sale-unit-price">Prix unitaire (FCFA)</Label>
          <Input id="sale-unit-price" type="number" {...register('unitPriceFcfa')} />
          {errors.unitPriceFcfa ? (
            <p className="text-sm text-destructive">{errors.unitPriceFcfa.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sale-discount">Remise (FCFA)</Label>
        <Input id="sale-discount" type="number" {...register('discountFcfa')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sale-observation">Observation</Label>
        <Textarea id="sale-observation" {...register('observation')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer la vente'}
      </Button>
    </form>
  );
}
