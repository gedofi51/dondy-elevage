import { BuildingDetailView } from './building-detail-view';

export default async function BuildingDetailPage(props: PageProps<'/batiments/[id]'>) {
  const { id } = await props.params;
  return <BuildingDetailView buildingId={id} />;
}
