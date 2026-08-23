import { EditBroilerBatchView } from './edit-broiler-batch-view';

export default async function EditBroilerBatchPage(props: PageProps<'/poulets-chair/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditBroilerBatchView batchId={id} />;
}
