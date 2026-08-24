'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useBreederBatches } from '@/features/breeder-batches/hooks';
import { BreederBatchTable } from '@/features/breeder-batches/components/breeder-batch-table';

const ACTIVE_STATUSES = new Set(['ACTIF', 'REFORME']);

export default function BreederBatchesListPage() {
  const { data, isLoading } = useBreederBatches();
  const [filter, setFilter] = useState<'actifs' | 'tous'>('actifs');

  // GET /breeder-batches n'a aucun filtre/pagination serveur (même gap que
  // Chair/Pondeuses, voir DETTE_TECHNIQUE.md) — filtrage en mémoire.
  const filtered = filter === 'actifs' ? data?.filter((b) => ACTIVE_STATUSES.has(b.status)) : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reproducteurs"
        description="Lots reproducteurs, de la constitution à la clôture."
        action={
          <Can permission={PERMISSIONS.BREEDER_BATCHES_CREATE}>
            <Button nativeButton={false} render={<Link href="/reproducteurs/nouveau" />}>
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

      <BreederBatchTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
