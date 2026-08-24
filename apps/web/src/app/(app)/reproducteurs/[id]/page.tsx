import { BreederBatchDetailView } from './breeder-batch-detail-view';

export default async function BreederBatchDetailPage(props: PageProps<'/reproducteurs/[id]'>) {
  const { id } = await props.params;
  return <BreederBatchDetailView batchId={id} />;
}
