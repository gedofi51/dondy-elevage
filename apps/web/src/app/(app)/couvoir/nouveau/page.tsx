import { PageHeader } from '@/components/shared/page-header';
import { IncubationBatchForm } from '@/features/incubation-batches/components/incubation-batch-form';

export default function NewIncubationBatchPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouveau lot d’incubation" />
      <div className="max-w-2xl">
        <IncubationBatchForm />
      </div>
    </div>
  );
}
