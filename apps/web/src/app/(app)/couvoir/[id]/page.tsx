import { IncubationBatchDetailView } from './incubation-batch-detail-view';

export default async function IncubationBatchDetailPage(props: PageProps<'/couvoir/[id]'>) {
  const { id } = await props.params;
  return <IncubationBatchDetailView batchId={id} />;
}
