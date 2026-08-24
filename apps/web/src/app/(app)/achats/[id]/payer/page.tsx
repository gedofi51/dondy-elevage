import { PayView } from './pay-view';

export default async function PayPage(props: PageProps<'/achats/[id]/payer'>) {
  const { id } = await props.params;
  return <PayView orderId={id} />;
}
