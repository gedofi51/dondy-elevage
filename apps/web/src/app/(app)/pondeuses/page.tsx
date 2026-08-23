'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useLayerBatches } from '@/features/layer-batches/hooks';
import { LayerBatchTable } from '@/features/layer-batches/components/layer-batch-table';

const ACTIVE_STATUSES = new Set(['ELEVAGE', 'PONTE']);

export default function LayerBatchesListPage() {
  const { data, isLoading } = useLayerBatches();
  const [filter, setFilter] = useState<'actifs' | 'tous'>('actifs');

  // GET /layer-batches n'a aucun filtre/pagination serveur (même gap que
  // broiler-batches, voir DETTE_TECHNIQUE.md) — filtrage en mémoire sur les
  // données déjà récupérées, palliatif d'affichage, pas une résolution du
  // gap réseau.
  const filtered = filter === 'actifs' ? data?.filter((b) => ACTIVE_STATUSES.has(b.status)) : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pondeuses"
        description="Lots de pondeuses, de l’élevage à la clôture."
        action={
          <Can permission={PERMISSIONS.LAYER_BATCHES_CREATE}>
            <Button nativeButton={false} render={<Link href="/pondeuses/nouveau" />}>
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

      <LayerBatchTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
