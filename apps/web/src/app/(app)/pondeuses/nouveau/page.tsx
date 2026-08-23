import { PageHeader } from '@/components/shared/page-header';
import { LayerBatchForm } from '@/features/layer-batches/components/layer-batch-form';

export default function NewLayerBatchPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouveau lot" />
      <div className="max-w-2xl">
        <LayerBatchForm />
      </div>
    </div>
  );
}
