import { PageHeader } from '@/components/shared/page-header';
import { BreederBatchForm } from '@/features/breeder-batches/components/breeder-batch-form';

export default function NewBreederBatchPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouveau lot reproducteur" />
      <div className="max-w-2xl">
        <BreederBatchForm />
      </div>
    </div>
  );
}
