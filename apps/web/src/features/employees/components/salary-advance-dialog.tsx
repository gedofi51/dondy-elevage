'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateSalaryAdvance } from '../hooks';
import {
  createSalaryAdvanceSchema,
  type CreateSalaryAdvanceFormInput,
  type CreateSalaryAdvanceFormValues,
} from '../schemas';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Création uniquement — pas d'édition dans cette UI ce lot (voir
 * schemas.ts, createSalaryAdvanceSchema). */
export function SalaryAdvanceDialog({
  employeeId,
  open,
  onOpenChange,
}: {
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMutation = useCreateSalaryAdvance(employeeId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateSalaryAdvanceFormInput, unknown, CreateSalaryAdvanceFormValues>({
    resolver: zodResolver(createSalaryAdvanceSchema),
    defaultValues: { date: todayIsoDate() },
  });

  async function onSubmit(values: CreateSalaryAdvanceFormValues) {
    try {
      await createMutation.mutateAsync({ ...values, observations: values.observations || undefined });
      toast.success('Avance enregistrée.');
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle avance sur salaire</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="advance-date">Date</Label>
            <Input id="advance-date" type="date" {...register('date')} />
            {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="advance-amount">Montant (FCFA)</Label>
            <Input id="advance-amount" type="number" {...register('amountFcfa')} />
            {errors.amountFcfa ? (
              <p className="text-sm text-destructive">{errors.amountFcfa.message}</p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Déduite automatiquement du prochain relevé de paie créé pour cet employé.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="advance-observations">Observations</Label>
            <Textarea id="advance-observations" {...register('observations')} />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer l’avance'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
