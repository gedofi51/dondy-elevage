import { PurchaseOrderDetailView } from './purchase-order-detail-view';

export default async function PurchaseOrderDetailPage(props: PageProps<'/achats/[id]'>) {
  const { id } = await props.params;
  return <PurchaseOrderDetailView orderId={id} />;
}
