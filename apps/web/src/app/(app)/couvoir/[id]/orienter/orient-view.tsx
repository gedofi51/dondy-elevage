'use client';

import { PageHeader } from '@/components/shared/page-header';
import { useIncubationBatch } from '@/features/incubation-batches/hooks';
import { useBatchLineageByIncubation } from '@/features/batch-lineage/hooks';
import { computeAvailableChicks } from '@/features/batch-lineage/available-chicks';
import { OrientationForm } from '@/features/batch-lineage/components/orientation-form';

export function OrientView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useIncubationBatch(batchId);
  const { data: lineageRows, isLoading: lineageLoading } = useBatchLineageByIncubation(batchId);

  if (isLoading || lineageLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const available = computeAvailableChicks(batch.chicksHatched, lineageRows);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Orienter les poussins — ${batch.code}`} />
      <div className="max-w-2xl">
        <OrientationForm incubationBatchId={batchId} available={available} />
      </div>
    </div>
  );
}
