'use client';

import { PageHeader } from '@/components/shared/page-header';
import { BreederBatchForm } from '@/features/breeder-batches/components/breeder-batch-form';
import { useBreederBatch } from '@/features/breeder-batches/hooks';

export function EditBreederBatchView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useBreederBatch(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${batch.code}`} />
      <div className="max-w-2xl">
        <BreederBatchForm batch={batch} />
      </div>
    </div>
  );
}
