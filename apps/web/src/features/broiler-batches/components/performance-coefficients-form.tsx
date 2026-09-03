'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { BroilerPerformanceCoefficients } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useBroilerPerformanceCoefficients,
  useUpdateBroilerPerformanceCoefficients,
} from '../hooks';
import {
  broilerPerformanceCoefficientsSchema,
  type BroilerPerformanceCoefficientsFormInput,
  type BroilerPerformanceCoefficientsFormValues,
} from '../schemas';

/** Poids par défaut appliqués côté serveur tant qu'aucun coefficient n'est
 * enregistré (voir buildBroilerPerformanceScore, DEFAULT_WEIGHT = 1/3) —
 * préremplissage uniquement, pas une valeur envoyée sans action de
 * l'utilisateur. */
const DEFAULT_WEIGHT_DISPLAY = (1 / 3).toFixed(2);

function toFormInput(
  coefficients: BroilerPerformanceCoefficients,
): BroilerPerformanceCoefficientsFormInput {
  return {
    mortalityWeight: String(coefficients.mortality?.weight ?? DEFAULT_WEIGHT_DISPLAY),
    icWeight: String(coefficients.ic?.weight ?? DEFAULT_WEIGHT_DISPLAY),
    icTarget: coefficients.ic?.target !== undefined ? String(coefficients.ic.target) : '',
    gmqWeight: String(coefficients.gmq?.weight ?? DEFAULT_WEIGHT_DISPLAY),
    gmqTarget: coefficients.gmq?.target !== undefined ? String(coefficients.gmq.target) : '',
  };
}

/**
 * Administration des coefficients — Poulets de chair (Lot 5). Réservé à
 * FARMS_UPDATE côté API (voir DETTE_TECHNIQUE.md, RBAC) — ce composant
 * n'est monté que sous `<Can permission={PERMISSIONS.FARMS_UPDATE}>`
 * (voir comparaison/broiler-comparison.tsx), jamais de vérification RBAC
 * dupliquée ici.
 *
 * Cible IC/GMQ laissée vide = composante exclue du score (voir
 * buildBroilerPerformanceScore) — jamais une valeur par défaut inventée,
 * contrairement au poids qui, lui, est toujours prérempli.
 */
export function BroilerPerformanceCoefficientsForm() {
  const { data: coefficients, isLoading } = useBroilerPerformanceCoefficients();

  if (isLoading || !coefficients) {
    return <Skeleton className="h-48 w-full" />;
  }

  return <BroilerPerformanceCoefficientsFormInner initialValue={coefficients} />;
}

function BroilerPerformanceCoefficientsFormInner({
  initialValue,
}: {
  initialValue: BroilerPerformanceCoefficients;
}) {
  const updateMutation = useUpdateBroilerPerformanceCoefficients();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<
    BroilerPerformanceCoefficientsFormInput,
    unknown,
    BroilerPerformanceCoefficientsFormValues
  >({
    resolver: zodResolver(broilerPerformanceCoefficientsSchema),
    defaultValues: toFormInput(initialValue),
  });

  async function onSubmit(values: BroilerPerformanceCoefficientsFormValues) {
    const payload: BroilerPerformanceCoefficients = {
      mortality: { weight: values.mortalityWeight },
      ic: {
        weight: values.icWeight,
        ...(values.icTarget !== undefined ? { target: values.icTarget } : {}),
      },
      gmq: {
        weight: values.gmqWeight,
        ...(values.gmqTarget !== undefined ? { target: values.gmqTarget } : {}),
      },
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
        <CardTitle>Pondération du score — Poulets de chair</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mortality-weight">Poids mortalité</Label>
              <Input id="mortality-weight" inputMode="decimal" {...register('mortalityWeight')} />
              {errors.mortalityWeight ? (
                <p className="text-xs text-destructive">{errors.mortalityWeight.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ic-weight">Poids IC</Label>
              <Input id="ic-weight" inputMode="decimal" {...register('icWeight')} />
              {errors.icWeight ? (
                <p className="text-xs text-destructive">{errors.icWeight.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ic-target">Cible IC (optionnel)</Label>
              <Input id="ic-target" inputMode="decimal" {...register('icTarget')} />
              {errors.icTarget ? (
                <p className="text-xs text-destructive">{errors.icTarget.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Vide : IC exclu du score (aucune cible connue).
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gmq-weight">Poids GMQ</Label>
              <Input id="gmq-weight" inputMode="decimal" {...register('gmqWeight')} />
              {errors.gmqWeight ? (
                <p className="text-xs text-destructive">{errors.gmqWeight.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gmq-target">Cible GMQ (g/j, optionnel)</Label>
              <Input id="gmq-target" inputMode="decimal" {...register('gmqTarget')} />
              {errors.gmqTarget ? (
                <p className="text-xs text-destructive">{errors.gmqTarget.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Vide : GMQ exclu du score (aucune cible connue).
                </p>
              )}
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
