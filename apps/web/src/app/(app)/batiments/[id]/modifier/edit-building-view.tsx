'use client';

import { PageHeader } from '@/components/shared/page-header';
import { BuildingForm } from '@/features/buildings/components/building-form';
import { useBuilding } from '@/features/buildings/hooks';

export function EditBuildingView({ buildingId }: { buildingId: string }) {
  const { data: building, isLoading } = useBuilding(buildingId);

  if (isLoading || !building) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${building.name}`} />
      <div className="max-w-2xl">
        <BuildingForm building={building} />
      </div>
    </div>
  );
}
