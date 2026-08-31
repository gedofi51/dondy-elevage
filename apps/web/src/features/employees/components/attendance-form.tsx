'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Attendance } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateAttendance, useUpdateAttendance } from '../hooks';
import {
  attendanceFormSchema,
  attendanceStatusLabels,
  attendanceStatusOptions,
  type AttendanceFormInput,
  type AttendanceFormValues,
} from '../schemas';

interface AttendanceFormProps {
  employeeId: string;
  date: string;
  /** `null` = pas encore de pointage ce jour (POST) ; sinon correction
   * d'un enregistrement existant (PATCH) — même branchement logique que
   * EmployeeForm (Lot 6a), mais ici sur la présence d'un enregistrement
   * plutôt qu'une prop statique. */
  existing: Attendance | null;
  onSuccess?: () => void;
}

export function AttendanceForm({ employeeId, date, existing, onSuccess }: AttendanceFormProps) {
  const createMutation = useCreateAttendance(employeeId);
  const updateMutation = useUpdateAttendance(employeeId, date);

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceFormInput, unknown, AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      status: existing?.status ?? 'PRESENT',
      checkInTime: existing?.checkInTime ?? '',
      checkOutTime: existing?.checkOutTime ?? '',
      observations: existing?.observations ?? '',
    },
  });

  const status = watch('status');

  // Les champs heure sont masqués hors statut PRESENT (règle métier :
  // non applicables pour ABSENT/CONGE/MALADIE, voir
  // assertAttendanceTimesConsistent côté API) — les vider explicitement
  // au changement de statut évite qu'une valeur saisie puis masquée reste
  // dans l'état du formulaire et fasse échouer la validation sans qu'aucun
  // message ne soit visible (champ caché).
  useEffect(() => {
    if (status !== 'PRESENT') {
      setValue('checkInTime', '');
      setValue('checkOutTime', '');
    }
  }, [status, setValue]);

  async function onSubmit(values: AttendanceFormValues) {
    const isPresent = values.status === 'PRESENT';
    const payload = {
      status: values.status,
      checkInTime: isPresent ? values.checkInTime || undefined : undefined,
      checkOutTime: isPresent ? values.checkOutTime || undefined : undefined,
      observations: values.observations || undefined,
    };
    try {
      if (existing) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync({ ...payload, date });
      }
      toast.success('Pointage enregistré.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement du pointage.')
          : 'Échec de l’enregistrement du pointage.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="att-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="att-status">
                <SelectValue>
                  {(value: (typeof attendanceStatusOptions)[number]) => attendanceStatusLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {attendanceStatusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {attendanceStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {status === 'PRESENT' ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="att-check-in">Heure d’arrivée</Label>
            <Input id="att-check-in" type="time" {...register('checkInTime')} />
            {errors.checkInTime ? (
              <p className="text-sm text-destructive">{errors.checkInTime.message}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="att-check-out">Heure de départ</Label>
            <Input id="att-check-out" type="time" {...register('checkOutTime')} />
            {errors.checkOutTime ? (
              <p className="text-sm text-destructive">{errors.checkOutTime.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="att-observations">Observations</Label>
        <Textarea id="att-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
