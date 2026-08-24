import { EditBreederBatchView } from './edit-breeder-batch-view';

export default async function EditBreederBatchPage(props: PageProps<'/reproducteurs/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditBreederBatchView batchId={id} />;
}
