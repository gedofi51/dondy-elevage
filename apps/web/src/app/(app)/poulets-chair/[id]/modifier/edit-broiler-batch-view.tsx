'use client';

import { PageHeader } from '@/components/shared/page-header';
import { BroilerBatchForm } from '@/features/broiler-batches/components/broiler-batch-form';
import { useBroilerBatch } from '@/features/broiler-batches/hooks';

export function EditBroilerBatchView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useBroilerBatch(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${batch.code}`} />
      <div className="max-w-2xl">
        <BroilerBatchForm batch={batch} />
      </div>
    </div>
  );
}
