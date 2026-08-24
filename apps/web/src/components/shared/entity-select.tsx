'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUsers } from '@/features/users/hooks';
import { useBuildings } from '@/features/buildings/hooks';
import { useIncubators } from '@/features/incubators/hooks';
import { useBreederBatches } from '@/features/breeder-batches/hooks';

/** Mutualisation Phase 13 — BuildingSelect/UserSelect étaient dupliqués mot
 * pour mot dans layer-batch-form.tsx et broiler-batch-form.tsx (voir
 * DETTE_TECHNIQUE.md). IncubatorSelect/BreederBatchSelect suivent le même
 * patron pour le nouveau module Couvoir. */

interface EntitySelectProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  control: Control<T>;
  error?: string;
  placeholder?: string;
}

export function UserSelect<T extends FieldValues>({
  name,
  label,
  control,
  error,
}: EntitySelectProps<T>) {
  const { data: users } = useUsers();
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              {/* SelectValue sans children-function affiche la value brute
                  (UUID) une fois sélectionnée — bug base-ui documenté dans
                  DETTE_TECHNIQUE.md Phase 11. */}
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (usersById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {users?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function BuildingSelect<T extends FieldValues>({
  name,
  control,
  error,
  label = 'Bâtiment',
}: Omit<EntitySelectProps<T>, 'label'> & { label?: string }) {
  const { data: buildings } = useBuildings();
  const buildingsById = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (buildingsById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {buildings?.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function IncubatorSelect<T extends FieldValues>({
  name,
  control,
  error,
  label = 'Couveuse',
}: Omit<EntitySelectProps<T>, 'label'> & { label?: string }) {
  const { data: incubators } = useIncubators();
  const incubatorsById = new Map((incubators ?? []).map((i) => [i.id, i.name]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (incubatorsById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {incubators?.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Affiche `availableFertileEggs` du lot sélectionné en texte d'aide — évite
 * un 409 facilement évitable à la création d'un lot d'incubation (précédent
 * direct : egg-stock-movement-form.tsx). */
export function BreederBatchSelect<T extends FieldValues>({
  name,
  control,
  error,
  label = 'Lot reproducteur',
}: Omit<EntitySelectProps<T>, 'label'> & { label?: string }) {
  const { data: breederBatches } = useBreederBatches();
  const batchesById = new Map((breederBatches ?? []).map((b) => [b.id, b]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const selected = field.value ? batchesById.get(field.value) : undefined;
          return (
            <>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={name}>
                  <SelectValue placeholder="Sélectionner…">
                    {(value: string) => (value ? (batchesById.get(value)?.code ?? value) : 'Sélectionner…')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {breederBatches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected ? (
                <p className="text-sm text-muted-foreground">
                  {selected.availableFertileEggs.toLocaleString('fr-FR')} œufs fécondés disponibles.
                </p>
              ) : null}
            </>
          );
        }}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
