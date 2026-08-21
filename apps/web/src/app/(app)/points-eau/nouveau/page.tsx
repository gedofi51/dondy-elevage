import { PageHeader } from '@/components/shared/page-header';
import { WaterPointForm } from '@/features/water-points/components/water-point-form';

export default function NewWaterPointPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouveau point d'eau" />
      <div className="max-w-lg">
        <WaterPointForm />
      </div>
    </div>
  );
}
