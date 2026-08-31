'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { Employee } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BuildingSelect, EmployeeSelect } from '@/components/shared/entity-select';
import { useCreateEmployee, useUpdateEmployee } from '../hooks';
import {
  createEmployeeSchema,
  employeeStatusLabels,
  employeeStatusOptions,
  updateEmployeeSchema,
  type CreateEmployeeFormInput,
  type CreateEmployeeFormValues,
  type UpdateEmployeeFormInput,
  type UpdateEmployeeFormValues,
} from '../schemas';

export function EmployeeForm({ employee }: { employee?: Employee }) {
  return employee ? <EditEmployeeForm employee={employee} /> : <CreateEmployeeForm />;
}

function CreateEmployeeForm() {
  const router = useRouter();
  const createMutation = useCreateEmployee();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeFormInput, unknown, CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    // buildingId/managerId initialisés : Select contrôlé dès le premier
    // rendu (voir DETTE_TECHNIQUE.md Phase 12).
    defaultValues: { buildingId: '', managerId: '' },
  });

  async function onSubmit(values: CreateEmployeeFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        buildingId: values.buildingId || undefined,
        managerId: values.managerId || undefined,
        contractType: values.contractType || undefined,
        phone: values.phone || undefined,
        endDate: values.endDate || undefined,
        observations: values.observations || undefined,
      });
      toast.success('Employé créé.');
      router.push(`/personnel/${created.id}`);
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
          <Label htmlFor="employee-name">Nom</Label>
          <Input id="employee-name" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-position">Poste</Label>
          <Input id="employee-position" {...register('position')} />
          {errors.position ? (
            <p className="text-sm text-destructive">{errors.position.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="employee-contract-type">Type de contrat</Label>
          <Input id="employee-contract-type" placeholder="CDI, CDD, journalier…" {...register('contractType')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-phone">Téléphone</Label>
          <Input id="employee-phone" {...register('phone')} />
        </div>
      </div>

      <BuildingSelect name="buildingId" label="Bâtiment / service" control={control} error={errors.buildingId?.message} />
      <EmployeeSelect name="managerId" control={control} error={errors.managerId?.message} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="employee-hire-date">Date d’embauche</Label>
          <Input id="employee-hire-date" type="date" {...register('hireDate')} />
          {errors.hireDate ? (
            <p className="text-sm text-destructive">{errors.hireDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-base-salary">Salaire de base (FCFA)</Label>
          <Input id="employee-base-salary" type="number" {...register('baseSalaryFcfa')} />
          {errors.baseSalaryFcfa ? (
            <p className="text-sm text-destructive">{errors.baseSalaryFcfa.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="employee-observations">Observations</Label>
        <Textarea id="employee-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer l’employé'}
      </Button>
    </form>
  );
}

function EditEmployeeForm({ employee }: { employee: Employee }) {
  const router = useRouter();
  const updateMutation = useUpdateEmployee(employee.id);
  // Règle UI (Lot 6a) : ne jamais supposer la présence de baseSalaryFcfa
  // (masqué pour certains rôles, voir DETTE_TECHNIQUE.md) — champ rendu
  // et soumis uniquement s'il est réellement présent dans la réponse.
  const canEditSalary = employee.baseSalaryFcfa !== undefined;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateEmployeeFormInput, unknown, UpdateEmployeeFormValues>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      buildingId: employee.buildingId ?? '',
      managerId: employee.managerId ?? '',
      name: employee.name,
      position: employee.position,
      contractType: employee.contractType ?? '',
      phone: employee.phone ?? '',
      hireDate: employee.hireDate.slice(0, 10),
      endDate: employee.endDate ? employee.endDate.slice(0, 10) : '',
      status: employee.status,
      observations: employee.observations ?? '',
      ...(canEditSalary ? { baseSalaryFcfa: employee.baseSalaryFcfa } : {}),
    },
  });

  async function onSubmit(values: UpdateEmployeeFormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        buildingId: values.buildingId || undefined,
        managerId: values.managerId || undefined,
        contractType: values.contractType || undefined,
        phone: values.phone || undefined,
        endDate: values.endDate || undefined,
        observations: values.observations || undefined,
        // Jamais envoyé si le champ n'a jamais été affiché/modifiable —
        // évite d'écraser un salaire par une valeur non voulue.
        baseSalaryFcfa: canEditSalary ? values.baseSalaryFcfa : undefined,
      });
      toast.success('Employé modifié.');
      router.push(`/personnel/${employee.id}`);
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
          <Label htmlFor="employee-name">Nom</Label>
          <Input id="employee-name" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-position">Poste</Label>
          <Input id="employee-position" {...register('position')} />
          {errors.position ? (
            <p className="text-sm text-destructive">{errors.position.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="employee-contract-type">Type de contrat</Label>
          <Input id="employee-contract-type" placeholder="CDI, CDD, journalier…" {...register('contractType')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-phone">Téléphone</Label>
          <Input id="employee-phone" {...register('phone')} />
        </div>
      </div>

      <BuildingSelect name="buildingId" label="Bâtiment / service" control={control} error={errors.buildingId?.message} />
      <EmployeeSelect name="managerId" control={control} error={errors.managerId?.message} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="employee-hire-date">Date d’embauche</Label>
          <Input id="employee-hire-date" type="date" {...register('hireDate')} />
          {errors.hireDate ? (
            <p className="text-sm text-destructive">{errors.hireDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-end-date">Date de sortie</Label>
          <Input id="employee-end-date" type="date" {...register('endDate')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="employee-status">Statut</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="employee-status">
                  <SelectValue>
                    {(value: (typeof employeeStatusOptions)[number]) => employeeStatusLabels[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employeeStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {employeeStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {(employee.status === 'SUSPENDU' || employee.status === 'DEPART') ? (
            <p className="text-xs text-muted-foreground">
              Fiche suspendue ou sortie : seule une réactivation explicite (repasser à « Actif ») est
              acceptée par le serveur, sans autre modification simultanée.
            </p>
          ) : null}
        </div>
        {canEditSalary ? (
          <div className="grid gap-1.5">
            <Label htmlFor="employee-base-salary">Salaire de base (FCFA)</Label>
            <Input id="employee-base-salary" type="number" {...register('baseSalaryFcfa')} />
            {errors.baseSalaryFcfa ? (
              <p className="text-sm text-destructive">{errors.baseSalaryFcfa.message}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="employee-observations">Observations</Label>
        <Textarea id="employee-observations" {...register('observations')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
