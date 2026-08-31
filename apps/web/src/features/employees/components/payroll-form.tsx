'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Payroll } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePayroll, useUpdatePayroll } from '../hooks';
import {
  createPayrollSchema,
  editPayrollSchema,
  type CreatePayrollFormInput,
  type CreatePayrollFormValues,
  type EditPayrollFormInput,
  type EditPayrollFormValues,
} from '../schemas';

interface PayrollFormProps {
  employeeId: string;
  /** Absent = nouveau relevé (POST) ; présent = correction d'un
   * BROUILLON (PATCH, bonus/retenues/observations uniquement — la
   * période est immuable après création, voir shared-types/payroll.ts). */
  payroll?: Payroll;
  onSuccess?: () => void;
}

export function PayrollForm({ employeeId, payroll, onSuccess }: PayrollFormProps) {
  return payroll ? (
    <EditPayrollForm employeeId={employeeId} payroll={payroll} onSuccess={onSuccess} />
  ) : (
    <CreatePayrollForm employeeId={employeeId} onSuccess={onSuccess} />
  );
}

function CreatePayrollForm({ employeeId, onSuccess }: { employeeId: string; onSuccess?: () => void }) {
  const createMutation = useCreatePayroll(employeeId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePayrollFormInput, unknown, CreatePayrollFormValues>({
    resolver: zodResolver(createPayrollSchema),
  });

  async function onSubmit(values: CreatePayrollFormValues) {
    try {
      await createMutation.mutateAsync({ ...values, observations: values.observations || undefined });
      toast.success('Relevé de paie créé.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création.')
          : 'Échec de la création.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="payroll-period-start">Début de période</Label>
          <Input id="payroll-period-start" type="date" {...register('periodStart')} />
          {errors.periodStart ? (
            <p className="text-sm text-destructive">{errors.periodStart.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payroll-period-end">Fin de période</Label>
          <Input id="payroll-period-end" type="date" {...register('periodEnd')} />
          {errors.periodEnd ? <p className="text-sm text-destructive">{errors.periodEnd.message}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="payroll-bonus">Prime (FCFA)</Label>
          <Input id="payroll-bonus" type="number" {...register('bonusFcfa')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payroll-deductions">Retenues (FCFA)</Label>
          <Input id="payroll-deductions" type="number" {...register('deductionsFcfa')} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Le salaire de base et les avances non déduites sont pris en compte automatiquement par le
        serveur — net à payer calculé à l’enregistrement, jamais recalculé ici.
      </p>

      <div className="grid gap-1.5">
        <Label htmlFor="payroll-observations">Observations</Label>
        <Textarea id="payroll-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le relevé'}
      </Button>
    </form>
  );
}

function EditPayrollForm({
  employeeId,
  payroll,
  onSuccess,
}: {
  employeeId: string;
  payroll: Payroll;
  onSuccess?: () => void;
}) {
  const updateMutation = useUpdatePayroll(employeeId, payroll.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditPayrollFormInput, unknown, EditPayrollFormValues>({
    resolver: zodResolver(editPayrollSchema),
    defaultValues: {
      bonusFcfa: payroll.bonusFcfa,
      deductionsFcfa: payroll.deductionsFcfa,
      observations: payroll.observations ?? '',
    },
  });

  async function onSubmit(values: EditPayrollFormValues) {
    try {
      await updateMutation.mutateAsync({ ...values, observations: values.observations || undefined });
      toast.success('Relevé de paie modifié.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <p className="text-xs text-muted-foreground">
        Période du {new Date(payroll.periodStart).toLocaleDateString('fr-FR')} au{' '}
        {new Date(payroll.periodEnd).toLocaleDateString('fr-FR')} — immuable après création.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="payroll-bonus">Prime (FCFA)</Label>
          <Input id="payroll-bonus" type="number" {...register('bonusFcfa')} />
          {errors.bonusFcfa ? <p className="text-sm text-destructive">{errors.bonusFcfa.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payroll-deductions">Retenues (FCFA)</Label>
          <Input id="payroll-deductions" type="number" {...register('deductionsFcfa')} />
          {errors.deductionsFcfa ? (
            <p className="text-sm text-destructive">{errors.deductionsFcfa.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="payroll-observations">Observations</Label>
        <Textarea id="payroll-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
