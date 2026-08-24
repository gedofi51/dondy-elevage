import { PageHeader } from '@/components/shared/page-header';
import { IncubatorForm } from '@/features/incubators/components/incubator-form';

export default function NewIncubatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvelle couveuse" />
      <div className="max-w-2xl">
        <IncubatorForm />
      </div>
    </div>
  );
}
