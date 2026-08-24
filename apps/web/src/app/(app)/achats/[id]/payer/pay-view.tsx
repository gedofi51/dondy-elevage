'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { usePurchaseOrder } from '@/features/purchase-orders/hooks';
import { SupplierPaymentForm } from '@/features/supplier-payments/components/supplier-payment-form';

export function PayView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data: order, isLoading } = usePurchaseOrder(orderId);

  if (isLoading || !order) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Payer — ${order.code}`} />
      <div className="max-w-lg">
        <SupplierPaymentForm
          purchaseOrderId={orderId}
          balanceFcfa={order.balanceFcfa}
          onSuccess={() => router.push(`/achats/${orderId}`)}
        />
      </div>
    </div>
  );
}
