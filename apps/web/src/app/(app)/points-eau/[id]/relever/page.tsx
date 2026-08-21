import { PageHeader } from '@/components/shared/page-header';
import { WaterReadingForm } from '@/features/water-points/components/water-reading-form';

export default async function WaterReadingPage(props: PageProps<'/points-eau/[id]/relever'>) {
  const { id } = await props.params;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Relevé du jour" />
      <div className="max-w-lg">
        <WaterReadingForm waterPointId={id} />
      </div>
    </div>
  );
}
