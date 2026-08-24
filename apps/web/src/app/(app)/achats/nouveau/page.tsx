import { PageHeader } from '@/components/shared/page-header';
import { PurchaseOrderForm } from '@/features/purchase-orders/components/purchase-order-form';

export default function NewPurchaseOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvelle commande" />
      <div className="max-w-3xl">
        <PurchaseOrderForm />
      </div>
    </div>
  );
}
