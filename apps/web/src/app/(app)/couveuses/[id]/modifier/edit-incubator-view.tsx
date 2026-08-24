'use client';

import { PageHeader } from '@/components/shared/page-header';
import { IncubatorForm } from '@/features/incubators/components/incubator-form';
import { useIncubator } from '@/features/incubators/hooks';

export function EditIncubatorView({ incubatorId }: { incubatorId: string }) {
  const { data: incubator, isLoading } = useIncubator(incubatorId);

  if (isLoading || !incubator) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${incubator.name}`} />
      <div className="max-w-2xl">
        <IncubatorForm incubator={incubator} />
      </div>
    </div>
  );
}
