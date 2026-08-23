'use client';

import { PageHeader } from '@/components/shared/page-header';
import { LayerBatchForm } from '@/features/layer-batches/components/layer-batch-form';
import { useLayerBatch } from '@/features/layer-batches/hooks';

export function EditLayerBatchView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useLayerBatch(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${batch.code}`} />
      <div className="max-w-2xl">
        <LayerBatchForm batch={batch} />
      </div>
    </div>
  );
}
