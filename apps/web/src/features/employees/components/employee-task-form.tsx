'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { EMPLOYEE_TASK_EDITABLE_STATUSES, type EmployeeTaskWithComputed } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateEmployeeTask, useUpdateEmployeeTask } from '../hooks';
import {
  createEmployeeTaskSchema,
  updateEmployeeTaskSchema,
  type CreateEmployeeTaskFormInput,
  type CreateEmployeeTaskFormValues,
  type UpdateEmployeeTaskFormInput,
  type UpdateEmployeeTaskFormValues,
} from '../schemas';
import { employeeTaskStatusConfig } from './employee-task-table';

interface EmployeeTaskFormProps {
  employeeId: string;
  /** Absent = création (POST, statut toujours A_FAIRE côté API) ; présent
   * = correction (PATCH) — même branchement que EmployeeForm (Lot 6a). */
  task?: EmployeeTaskWithComputed;
  onSuccess?: () => void;
}

export function EmployeeTaskForm({ employeeId, task, onSuccess }: EmployeeTaskFormProps) {
  return task ? (
    <EditEmployeeTaskForm employeeId={employeeId} task={task} onSuccess={onSuccess} />
  ) : (
    <CreateEmployeeTaskForm employeeId={employeeId} onSuccess={onSuccess} />
  );
}

function CreateEmployeeTaskForm({
  employeeId,
  onSuccess,
}: {
  employeeId: string;
  onSuccess?: () => void;
}) {
  const createMutation = useCreateEmployeeTask(employeeId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeTaskFormInput, unknown, CreateEmployeeTaskFormValues>({
    resolver: zodResolver(createEmployeeTaskSchema),
  });

  async function onSubmit(values: CreateEmployeeTaskFormValues) {
    try {
      await createMutation.mutateAsync({ ...values, observations: values.observations || undefined });
      toast.success('Tâche créée.');
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

function EditEmployeeTaskForm({
  employeeId,
  task,
  onSuccess,
}: {
  employeeId: string;
  task: EmployeeTaskWithComputed;
  onSuccess?: () => void;
}) {
  const updateMutation = useUpdateEmployeeTask(employeeId, task.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateEmployeeTaskFormInput, unknown, UpdateEmployeeTaskFormValues>({
    resolver: zodResolver(updateEmployeeTaskSchema),
    defaultValues: {
      designation: task.designation,
      dueDate: task.dueDate.slice(0, 10),
      status: task.status === 'ANNULEE' ? 'A_FAIRE' : task.status,
      observations: task.observations ?? '',
    },
  });

  async function onSubmit(values: UpdateEmployeeTaskFormValues) {
    try {
      await updateMutation.mutateAsync({ ...values, observations: values.observations || undefined });
      toast.success('Tâche modifiée.');
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
      <div className="grid gap-1.5">
        <Label htmlFor="task-designation">Désignation</Label>
        <Input id="task-designation" {...register('designation')} />
        {errors.designation ? (
          <p className="text-sm text-destructive">{errors.designation.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="task-due-date">Échéance</Label>
          <Input id="task-due-date" type="date" {...register('dueDate')} />
          {errors.dueDate ? <p className="text-sm text-destructive">{errors.dueDate.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-status">Statut</Label>
          {/* ANNULEE n'apparaît jamais ici — EMPLOYEE_TASK_EDITABLE_STATUSES
              exclut ce statut, interdiction explicite du Lot 6c
              (uniquement atteignable via l'endpoint /annuler dédié). */}
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="task-status">
                  <SelectValue>
                    {(value: (typeof EMPLOYEE_TASK_EDITABLE_STATUSES)[number]) =>
                      employeeTaskStatusConfig[value].label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_TASK_EDITABLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {employeeTaskStatusConfig[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="task-observations">Observations</Label>
        <Textarea id="task-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
