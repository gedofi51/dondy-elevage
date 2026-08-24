'use client';

import { PageHeader } from '@/components/shared/page-header';
import { ChickBatchForm } from '@/features/chick-batches/components/chick-batch-form';
import { useChickBatch } from '@/features/chick-batches/hooks';

export function EditChickBatchView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useChickBatch(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${batch.code}`} />
      <div className="max-w-2xl">
        <ChickBatchForm batch={batch} />
      </div>
    </div>
  );
}
