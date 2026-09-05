import { EditBuildingView } from './edit-building-view';

export default async function EditBuildingPage(props: PageProps<'/batiments/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditBuildingView buildingId={id} />;
}
