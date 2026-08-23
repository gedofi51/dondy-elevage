import { SellBroilerBatchView } from './sell-broiler-batch-view';

export default async function SellBroilerBatchPage(props: PageProps<'/poulets-chair/[id]/vendre'>) {
  const { id } = await props.params;
  return <SellBroilerBatchView batchId={id} />;
}
