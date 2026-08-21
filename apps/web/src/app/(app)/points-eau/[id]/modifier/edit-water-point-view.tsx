'use client';

import { PageHeader } from '@/components/shared/page-header';
import { WaterPointForm } from '@/features/water-points/components/water-point-form';
import { useWaterPoint } from '@/features/water-points/hooks';

export function EditWaterPointView({ waterPointId }: { waterPointId: string }) {
  const { data: waterPoint, isLoading } = useWaterPoint(waterPointId);

  if (isLoading || !waterPoint) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${waterPoint.name}`} />
      <div className="max-w-lg">
        <WaterPointForm waterPoint={waterPoint} />
      </div>
    </div>
  );
}
