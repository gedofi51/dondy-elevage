'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useIncubationBatches } from '@/features/incubation-batches/hooks';
import { IncubationBatchTable } from '@/features/incubation-batches/components/incubation-batch-table';

const ACTIVE_STATUSES = new Set(['EN_INCUBATION', 'ECLOS']);

export default function IncubationBatchesListPage() {
  const { data, isLoading } = useIncubationBatches();
  const [filter, setFilter] = useState<'actifs' | 'tous'>('actifs');

  // GET /incubation-batches n'a aucun filtre/pagination serveur (même gap
  // que Chair/Pondeuses/Reproducteurs, voir DETTE_TECHNIQUE.md).
  const filtered = filter === 'actifs' ? data?.filter((b) => ACTIVE_STATUSES.has(b.status)) : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Couvoir"
        description="Lots d’incubation, de la mise en couveuse à l’orientation des poussins."
        action={
          <Can permission={PERMISSIONS.INCUBATION_BATCHES_CREATE}>
            <Button nativeButton={false} render={<Link href="/couvoir/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau lot
            </Button>
          </Can>
        }
      />

      <div className="flex gap-2">
        <Button
          variant={filter === 'actifs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('actifs')}
        >
          Actifs
        </Button>
        <Button
          variant={filter === 'tous' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('tous')}
        >
          Tous
        </Button>
      </div>

      <IncubationBatchTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
