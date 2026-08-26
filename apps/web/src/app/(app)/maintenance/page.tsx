'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { useMaintenanceTasks } from '@/features/maintenance/hooks';
import { MaintenanceTaskTable } from '@/features/maintenance/components/maintenance-task-table';
import { useAssets } from '@/features/assets/hooks';

const OPEN_STATUSES = new Set(['A_FAIRE', 'EN_COURS']);

/**
 * Vue globale, LECTURE SEULE — aucune création ici (voir DETTE_TECHNIQUE.md
 * Phase 19, décision §A : MaintenanceTask se comporte comme une file
 * d'attente transverse, à la manière d'Alerts, pas comme une sous-ressource
 * pure d'un seul actif). Toute création se fait depuis l'onglet Maintenance
 * de la fiche Actif concernée.
 */
export default function MaintenanceListPage() {
  const { data: tasks, isLoading } = useMaintenanceTasks();
  const { data: assets } = useAssets();
  const [filter, setFilter] = useState<'ouvertes' | 'toutes'>('ouvertes');

  const assetLabelById = useMemo(
    () => new Map((assets ?? []).map((a) => [a.id, `${a.code} — ${a.designation}`])),
    [assets],
  );

  const sorted = useMemo(() => {
    const list = tasks ? [...tasks] : [];
    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return list;
  }, [tasks]);
  const filtered = filter === 'ouvertes' ? sorted.filter((t) => OPEN_STATUSES.has(t.status)) : sorted;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Maintenance"
        description="Toutes les tâches de maintenance de la ferme, triées par échéance."
      />

      <div className="flex gap-2">
        <Button
          variant={filter === 'ouvertes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('ouvertes')}
        >
          Ouvertes
        </Button>
        <Button
          variant={filter === 'toutes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('toutes')}
        >
          Toutes
        </Button>
      </div>

      <MaintenanceTaskTable
        data={filtered}
        isLoading={isLoading}
        showAssetColumn
        assetLabelById={assetLabelById}
      />
    </div>
  );
}
