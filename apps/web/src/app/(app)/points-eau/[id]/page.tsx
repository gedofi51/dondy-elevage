import { WaterPointDetailView } from './water-point-detail-view';

export default async function WaterPointDetailPage(props: PageProps<'/points-eau/[id]'>) {
  const { id } = await props.params;
  return <WaterPointDetailView waterPointId={id} />;
}
