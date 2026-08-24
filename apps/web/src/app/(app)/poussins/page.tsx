'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { useChickBatches } from '@/features/chick-batches/hooks';
import { ChickBatchTable } from '@/features/chick-batches/components/chick-batch-table';

const ACTIVE_STATUSES = new Set(['ACTIF']);

// Pas de bouton "Nouveau" : aucun POST exposé, un ChickBatch naît toujours
// d'une orientation (voir /couvoir/[id]/orienter).
export default function ChickBatchesListPage() {
  const { data, isLoading } = useChickBatches();
  const [filter, setFilter] = useState<'actifs' | 'tous'>('actifs');

  // GET /chick-batches n'a aucun filtre/pagination serveur (même gap que
  // les autres listes du module, voir DETTE_TECHNIQUE.md).
  const filtered = filter === 'actifs' ? data?.filter((b) => ACTIVE_STATUSES.has(b.status)) : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Poussins" description="Lots de poussins issus d’une orientation." />

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

      <ChickBatchTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
