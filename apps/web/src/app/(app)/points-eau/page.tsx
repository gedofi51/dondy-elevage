'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useWaterPoints } from '@/features/water-points/hooks';
import { WaterPointTable } from '@/features/water-points/components/water-point-table';

export default function WaterPointsListPage() {
  const { data, isLoading } = useWaterPoints();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Points d'eau"
        description="Points de vente et de distribution d'eau de la ferme."
        action={
          <Can permission={PERMISSIONS.WATER_POINTS_CREATE}>
            <Button nativeButton={false} render={<Link href="/points-eau/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau point d&apos;eau
            </Button>
          </Can>
        }
      />
      <WaterPointTable data={data} isLoading={isLoading} />
    </div>
  );
}
