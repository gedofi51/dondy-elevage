import { BroilerBatchDetailView } from './broiler-batch-detail-view';

export default async function BroilerBatchDetailPage(props: PageProps<'/poulets-chair/[id]'>) {
  const { id } = await props.params;
  return <BroilerBatchDetailView batchId={id} />;
}
