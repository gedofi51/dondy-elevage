'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateMaintenanceTask } from '../hooks';
import {
  createMaintenanceTaskSchema,
  maintenanceTaskManualTypeOptions,
  type CreateMaintenanceTaskFormInput,
  type CreateMaintenanceTaskFormValues,
} from '../schemas';
import { maintenanceTaskTypeLabels } from './maintenance-task-table';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** assetId connu du contexte — jamais dans le schéma Zod (voir
 * DETTE_TECHNIQUE.md Phase 14). planId reste toujours null pour une tâche
 * créée manuellement (voir CreateMaintenanceTaskInput). */
export function MaintenanceTaskForm({
  assetId,
  onSuccess,
}: {
  assetId: string;
  onSuccess?: () => void;
}) {
  const createMutation = useCreateMaintenanceTask();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaintenanceTaskFormInput, unknown, CreateMaintenanceTaskFormValues>({
    resolver: zodResolver(createMaintenanceTaskSchema),
    defaultValues: { type: 'CORRECTIVE', dueDate: todayIsoDate() },
  });

  async function onSubmit(values: CreateMaintenanceTaskFormValues) {
    try {
      await createMutation.mutateAsync({
        assetId,
        ...values,
        observations: values.observations || undefined,
      });
      toast.success('Tâche de maintenance créée.');
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
      <div className="grid gap-1.5">
        <Label htmlFor="task-type">Type</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="task-type">
                <SelectValue>
                  {(value: (typeof maintenanceTaskManualTypeOptions)[number]) =>
                    maintenanceTaskTypeLabels[value]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {maintenanceTaskManualTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {maintenanceTaskTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="task-designation">Désignation</Label>
        <Input id="task-designation" {...register('designation')} />
        {errors.designation ? (
          <p className="text-sm text-destructive">{errors.designation.message}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="task-due-date">Échéance</Label>
        <Input id="task-due-date" type="date" {...register('dueDate')} />
        {errors.dueDate ? <p className="text-sm text-destructive">{errors.dueDate.message}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="task-observations">Observations</Label>
        <Textarea id="task-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer la tâche'}
      </Button>
    </form>
  );
}
