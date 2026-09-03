'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { LayerPerformanceCoefficients } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useLayerPerformanceCoefficients,
  useUpdateLayerPerformanceCoefficients,
} from '../hooks';
import {
  layerPerformanceCoefficientsSchema,
  type LayerPerformanceCoefficientsFormInput,
  type LayerPerformanceCoefficientsFormValues,
} from '../schemas';

/** Voir broiler-batches/components/performance-coefficients-form.tsx —
 * DEFAULT_WEIGHT = 1/2 côté buildLayerPerformanceScore (2 composantes). */
const DEFAULT_WEIGHT_DISPLAY = (1 / 2).toFixed(2);

function toFormInput(
  coefficients: LayerPerformanceCoefficients,
): LayerPerformanceCoefficientsFormInput {
  return {
    mortalityWeight: String(coefficients.mortality?.weight ?? DEFAULT_WEIGHT_DISPLAY),
    layingRateWeight: String(coefficients.layingRate?.weight ?? DEFAULT_WEIGHT_DISPLAY),
  };
}

/** Administration des coefficients — Pondeuses (Lot 5). Réservé à
 * FARMS_UPDATE côté API — monté uniquement sous
 * `<Can permission={PERMISSIONS.FARMS_UPDATE}>` (voir
 * comparaison/layer-comparison.tsx). */
export function LayerPerformanceCoefficientsForm() {
  const { data: coefficients, isLoading } = useLayerPerformanceCoefficients();

  if (isLoading || !coefficients) {
    return <Skeleton className="h-32 w-full" />;
  }

  return <LayerPerformanceCoefficientsFormInner initialValue={coefficients} />;
}

function LayerPerformanceCoefficientsFormInner({
  initialValue,
}: {
  initialValue: LayerPerformanceCoefficients;
}) {
  const updateMutation = useUpdateLayerPerformanceCoefficients();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<
    LayerPerformanceCoefficientsFormInput,
    unknown,
    LayerPerformanceCoefficientsFormValues
  >({
    resolver: zodResolver(layerPerformanceCoefficientsSchema),
    defaultValues: toFormInput(initialValue),
  });

  async function onSubmit(values: LayerPerformanceCoefficientsFormValues) {
    const payload: LayerPerformanceCoefficients = {
      mortality: { weight: values.mortalityWeight },
      layingRate: { weight: values.layingRateWeight },
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
        <CardTitle>Pondération du score — Pondeuses</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="layer-mortality-weight">Poids mortalité</Label>
              <Input
                id="layer-mortality-weight"
                inputMode="decimal"
                {...register('mortalityWeight')}
              />
              {errors.mortalityWeight ? (
                <p className="text-xs text-destructive">{errors.mortalityWeight.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="laying-rate-weight">Poids taux de ponte</Label>
              <Input
                id="laying-rate-weight"
                inputMode="decimal"
                {...register('layingRateWeight')}
              />
              {errors.layingRateWeight ? (
                <p className="text-xs text-destructive">{errors.layingRateWeight.message}</p>
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
