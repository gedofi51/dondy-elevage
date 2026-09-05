import { PageHeader } from '@/components/shared/page-header';
import { BuildingForm } from '@/features/buildings/components/building-form';

export default function NewBuildingPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouveau bâtiment" />
      <div className="max-w-2xl">
        <BuildingForm />
      </div>
    </div>
  );
}
