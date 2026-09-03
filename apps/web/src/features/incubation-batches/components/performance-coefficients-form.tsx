'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { IncubationPerformanceCoefficients } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useIncubationPerformanceCoefficients,
  useUpdateIncubationPerformanceCoefficients,
} from '../hooks';
import {
  incubationPerformanceCoefficientsSchema,
  type IncubationPerformanceCoefficientsFormInput,
  type IncubationPerformanceCoefficientsFormValues,
} from '../schemas';

/** Voir broiler-batches/components/performance-coefficients-form.tsx —
 * DEFAULT_WEIGHT = 1/2 côté buildIncubationPerformanceScore. */
const DEFAULT_WEIGHT_DISPLAY = (1 / 2).toFixed(2);

function toFormInput(
  coefficients: IncubationPerformanceCoefficients,
): IncubationPerformanceCoefficientsFormInput {
  return {
    hatchRateWeight: String(coefficients.hatchRate?.weight ?? DEFAULT_WEIGHT_DISPLAY),
    fertilityRateWeight: String(coefficients.fertilityRate?.weight ?? DEFAULT_WEIGHT_DISPLAY),
  };
}

/** Administration des coefficients — Couvoir (Lot 5). Réservé à
 * FARMS_UPDATE côté API — monté uniquement sous
 * `<Can permission={PERMISSIONS.FARMS_UPDATE}>` (voir
 * comparaison/incubation-comparison.tsx). */
export function IncubationPerformanceCoefficientsForm() {
  const { data: coefficients, isLoading } = useIncubationPerformanceCoefficients();

  if (isLoading || !coefficients) {
    return <Skeleton className="h-32 w-full" />;
  }

  return <IncubationPerformanceCoefficientsFormInner initialValue={coefficients} />;
}

function IncubationPerformanceCoefficientsFormInner({
  initialValue,
}: {
  initialValue: IncubationPerformanceCoefficients;
}) {
  const updateMutation = useUpdateIncubationPerformanceCoefficients();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<
    IncubationPerformanceCoefficientsFormInput,
    unknown,
    IncubationPerformanceCoefficientsFormValues
  >({
    resolver: zodResolver(incubationPerformanceCoefficientsSchema),
    defaultValues: toFormInput(initialValue),
  });

  async function onSubmit(values: IncubationPerformanceCoefficientsFormValues) {
    const payload: IncubationPerformanceCoefficients = {
      hatchRate: { weight: values.hatchRateWeight },
      fertilityRate: { weight: values.fertilityRateWeight },
    };
    try {
      await updateMutation.mutateAsync(payload);
      toast.success('Coefficients enregistrés.');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement des coefficients.')
          : 'Échec de l’enregistrement des coefficients.',
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pondération du score — Couvoir</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="hatch-rate-weight">Poids taux d’éclosion</Label>
              <Input id="hatch-rate-weight" inputMode="decimal" {...register('hatchRateWeight')} />
              {errors.hatchRateWeight ? (
                <p className="text-xs text-destructive">{errors.hatchRateWeight.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fertility-rate-weight">Poids taux de fécondité</Label>
              <Input
                id="fertility-rate-weight"
                inputMode="decimal"
                {...register('fertilityRateWeight')}
              />
              {errors.fertilityRateWeight ? (
                <p className="text-xs text-destructive">{errors.fertilityRateWeight.message}</p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
