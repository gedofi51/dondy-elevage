import { ChickBatchDetailView } from './chick-batch-detail-view';

export default async function ChickBatchDetailPage(props: PageProps<'/poussins/[id]'>) {
  const { id } = await props.params;
  return <ChickBatchDetailView batchId={id} />;
}
