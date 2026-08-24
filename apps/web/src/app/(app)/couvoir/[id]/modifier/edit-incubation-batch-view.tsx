'use client';

import { PageHeader } from '@/components/shared/page-header';
import { IncubationBatchForm } from '@/features/incubation-batches/components/incubation-batch-form';
import { useIncubationBatch } from '@/features/incubation-batches/hooks';

export function EditIncubationBatchView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useIncubationBatch(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${batch.code}`} />
      <div className="max-w-2xl">
        <IncubationBatchForm batch={batch} />
      </div>
    </div>
  );
}
