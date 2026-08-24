import { EditIncubationBatchView } from './edit-incubation-batch-view';

export default async function EditIncubationBatchPage(props: PageProps<'/couvoir/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditIncubationBatchView batchId={id} />;
}
