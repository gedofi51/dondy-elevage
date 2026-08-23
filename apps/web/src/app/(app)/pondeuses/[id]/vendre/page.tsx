import { SellLayerBatchView } from './sell-layer-batch-view';

export default async function SellLayerBatchPage(props: PageProps<'/pondeuses/[id]/vendre'>) {
  const { id } = await props.params;
  return <SellLayerBatchView batchId={id} />;
}
