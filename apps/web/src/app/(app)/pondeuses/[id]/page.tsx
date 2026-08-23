import { LayerBatchDetailView } from './layer-batch-detail-view';

export default async function LayerBatchDetailPage(props: PageProps<'/pondeuses/[id]'>) {
  const { id } = await props.params;
  return <LayerBatchDetailView batchId={id} />;
}
