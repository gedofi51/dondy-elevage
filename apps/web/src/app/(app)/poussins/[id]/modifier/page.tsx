import { EditChickBatchView } from './edit-chick-batch-view';

export default async function EditChickBatchPage(props: PageProps<'/poussins/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditChickBatchView batchId={id} />;
}
