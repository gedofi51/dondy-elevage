import { OrientView } from './orient-view';

export default async function OrientPage(props: PageProps<'/couvoir/[id]/orienter'>) {
  const { id } = await props.params;
  return <OrientView batchId={id} />;
}
