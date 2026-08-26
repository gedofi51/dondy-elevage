'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useAssets } from '@/features/assets/hooks';
import { AssetTable } from '@/features/assets/components/asset-table';

export default function AssetsListPage() {
  const { data, isLoading } = useAssets();
  const [filter, setFilter] = useState<'actifs' | 'tous'>('actifs');

  // GET /assets n'a aucun filtre/pagination serveur — filtrage en mémoire
  // sur les données déjà récupérées, même palliatif que les autres listes
  // du projet (voir DETTE_TECHNIQUE.md).
  const filtered = filter === 'actifs' ? data?.filter((a) => a.status !== 'REFORME') : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patrimoine"
        description="Actifs de l'exploitation — acquisition, amortissement, coût total de possession."
        action={
          <Can permission={PERMISSIONS.ASSETS_CREATE}>
            <Button nativeButton={false} render={<Link href="/patrimoine/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvel actif
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

      <AssetTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
