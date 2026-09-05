'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUsers } from '@/features/users/hooks';
import { useBuildings } from '@/features/buildings/hooks';
import { useBlocks } from '@/features/blocks/hooks';
import { useIncubators } from '@/features/incubators/hooks';
import { useBreederBatches } from '@/features/breeder-batches/hooks';
import { useSuppliers } from '@/features/suppliers/hooks';
import { useItems } from '@/features/items/hooks';
import { useEmployees } from '@/features/employees/hooks';

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

/** Option A (Bâtiments/Blocs) — filtré par `buildingId` (le bâtiment déjà
 * choisi dans le même formulaire), jamais affiché avant qu'un bâtiment soit
 * sélectionné. `useController` (pas `Controller`) : nécessaire pour
 * l'effet ci-dessous, qui efface le bloc choisi s'il n'appartient plus au
 * bâtiment courant (bâtiment changé après coup) — jamais avant que la
 * liste des blocs ait fini de charger, sinon un blockId déjà enregistré
 * serait effacé à tort le temps du premier rendu (cas de l'édition). */
export function BlockSelect<T extends FieldValues>({
  name,
  control,
  error,
  label = 'Bloc',
  buildingId,
}: Omit<EntitySelectProps<T>, 'label'> & { label?: string; buildingId: string | undefined }) {
  const { data: allBlocks } = useBlocks();
  const blocks = useMemo(
    () => (allBlocks ?? []).filter((b) => b.buildingId === buildingId),
    [allBlocks, buildingId],
  );
  const blocksById = new Map(blocks.map((b) => [b.id, b]));
  const { field } = useController({ name, control });

  useEffect(() => {
    if (allBlocks === undefined) return;
    if (field.value && !blocksById.has(field.value)) {
      field.onChange('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, allBlocks]);

  const placeholder = !buildingId
    ? "Sélectionnez d'abord un bâtiment"
    : blocks.length === 0
      ? 'Aucun bloc pour ce bâtiment'
      : 'Sélectionner…';
  // Sentinel pour l'option "Aucun" — un `SelectItem value=""` serait
  // indiscernable d'une valeur absente pour base-ui (même contrainte que
  // le filtre ALL='__ALL__' de la liste Utilisateurs). Sans cette option
  // explicite dans SelectContent, il serait impossible de revenir à "pas de
  // bloc" une fois un bloc choisi — seul un champ jamais rempli resterait
  // vide.
  const NONE = '__NONE__';

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label} (optionnel)</Label>
      <Select
        value={field.value || NONE}
        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
        disabled={!buildingId || blocks.length === 0}
      >
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder}>
            {(value: string) => {
              if (value === NONE || !value) return 'Aucun (bâtiment entier)';
              const block = blocksById.get(value);
              return block ? (block.code ? `${block.name} (${block.code})` : block.name) : value;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Aucun (bâtiment entier)</SelectItem>
          {blocks.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.code ? `${b.name} (${b.code})` : b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

/** Mutualisation Phase 14 — 3 usages prévus (Item, PurchaseOrder,
 * Expense), même seuil que BuildingSelect/UserSelect en Phase 13. */
export function SupplierSelect<T extends FieldValues>({
  name,
  control,
  error,
  label = 'Fournisseur',
}: Omit<EntitySelectProps<T>, 'label'> & { label?: string }) {
  const { data: suppliers } = useSuppliers();
  const suppliersById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (suppliersById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
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

/** Mutualisation Phase 14 — 2 usages (mouvement de stock, lignes de
 * commande fournisseur). Affiche le stock disponible en aide, même
 * précédent que BreederBatchSelect. */
export function ItemSelect<T extends FieldValues>({
  name,
  control,
  error,
  label = 'Article',
}: Omit<EntitySelectProps<T>, 'label'> & { label?: string }) {
  const { data: items } = useItems();
  const itemsById = new Map((items ?? []).map((i) => [i.id, i]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const selected = field.value ? itemsById.get(field.value) : undefined;
          return (
            <>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={name}>
                  <SelectValue placeholder="Sélectionner…">
                    {(value: string) => (value ? (itemsById.get(value)?.name ?? value) : 'Sélectionner…')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {items?.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected ? (
                <p className="text-sm text-muted-foreground">
                  Stock actuel : {selected.currentStock} {selected.unit}.
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

/** Personnel (Lot 6a) — liste des employés (non filtrée sur l'employé
 * courant en édition : le backend refuse déjà managerId === id en 400,
 * pas de préfiltrage frontend supplémentaire pour ce cas rare). */
export function EmployeeSelect<T extends FieldValues>({
  name,
  control,
  error,
  label = 'Responsable hiérarchique',
}: Omit<EntitySelectProps<T>, 'label'> & { label?: string }) {
  const { data: employees } = useEmployees();
  const employeesById = new Map((employees ?? []).map((e) => [e.id, `${e.code} — ${e.name}`]));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              <SelectValue placeholder="Sélectionner…">
                {(value: string) => (value ? (employeesById.get(value) ?? value) : 'Sélectionner…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees?.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.code} — {e.name}
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
