import { EditWaterPointView } from './edit-water-point-view';

export default async function EditWaterPointPage(props: PageProps<'/points-eau/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditWaterPointView waterPointId={id} />;
}
