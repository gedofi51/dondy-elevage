import { PageHeader } from '@/components/shared/page-header';
import { BroilerBatchForm } from '@/features/broiler-batches/components/broiler-batch-form';

export default function NewBroilerBatchPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvelle bande" />
      <div className="max-w-2xl">
        <BroilerBatchForm />
      </div>
    </div>
  );
}
