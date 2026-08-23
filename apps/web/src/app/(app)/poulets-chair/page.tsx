'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useBroilerBatches } from '@/features/broiler-batches/hooks';
import { BroilerBatchTable } from '@/features/broiler-batches/components/broiler-batch-table';

const ACTIVE_STATUSES = new Set([
  'PLANIFIEE',
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
]);

export default function BroilerBatchesListPage() {
  const { data, isLoading } = useBroilerBatches();
  const [filter, setFilter] = useState<'actives' | 'toutes'>('actives');

  // GET /broiler-batches n'a aucun filtre/pagination serveur (voir
  // DETTE_TECHNIQUE.md) — filtrage en mémoire sur les données déjà
  // récupérées, palliatif d'affichage, pas une résolution du gap réseau.
  const filtered = filter === 'actives' ? data?.filter((b) => ACTIVE_STATUSES.has(b.status)) : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Poulets de chair"
        description="Bandes de poulets de chair, du démarrage à la clôture."
        action={
          <Can permission={PERMISSIONS.BROILER_BATCHES_CREATE}>
            <Button nativeButton={false} render={<Link href="/poulets-chair/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvelle bande
            </Button>
          </Can>
        }
      />

      <div className="flex gap-2">
        <Button
          variant={filter === 'actives' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('actives')}
        >
          Actives
        </Button>
        <Button
          variant={filter === 'toutes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('toutes')}
        >
          Toutes
        </Button>
      </div>

      <BroilerBatchTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
