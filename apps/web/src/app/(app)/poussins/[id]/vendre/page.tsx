import { SellChickBatchView } from './sell-chick-batch-view';

export default async function SellChickBatchPage(props: PageProps<'/poussins/[id]/vendre'>) {
  const { id } = await props.params;
  return <SellChickBatchView batchId={id} />;
}
