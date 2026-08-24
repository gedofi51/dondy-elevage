import { EditIncubatorView } from './edit-incubator-view';

export default async function EditIncubatorPage(props: PageProps<'/couveuses/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditIncubatorView incubatorId={id} />;
}
