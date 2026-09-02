'use client';

import { Checkbox } from '@/components/ui/checkbox';

export interface EntityOption {
  id: string;
  label: string;
}

/** Sélection de 2+ entités à comparer (Lot 4) — cases à cocher plutôt
 * qu'un multi-select natif : le nombre d'entités par ferme reste modeste
 * (bandes/couveuses), et les cases à cocher rendent la sélection actuelle
 * visible sans ouvrir de menu, contrairement à un `<select multiple>`. */
export function EntitySelector({
  options,
  selectedIds,
  onToggle,
}: {
  options: EntityOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune entité disponible pour cette comparaison.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.id}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <Checkbox
            checked={selectedIds.includes(option.id)}
            onCheckedChange={() => onToggle(option.id)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
