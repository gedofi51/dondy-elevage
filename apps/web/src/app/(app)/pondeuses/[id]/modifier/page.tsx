import { EditLayerBatchView } from './edit-layer-batch-view';

export default async function EditLayerBatchPage(props: PageProps<'/pondeuses/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditLayerBatchView batchId={id} />;
}
