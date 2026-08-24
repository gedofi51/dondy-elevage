import { ReceiveView } from './receive-view';

export default async function ReceivePage(props: PageProps<'/achats/[id]/receptionner'>) {
  const { id } = await props.params;
  return <ReceiveView orderId={id} />;
}
