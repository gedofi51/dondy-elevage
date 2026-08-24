'use client';

import { PageHeader } from '@/components/shared/page-header';
import { usePurchaseOrder } from '@/features/purchase-orders/hooks';
import { GoodsReceiptForm } from '@/features/purchase-orders/components/goods-receipt-form';

export function ReceiveView({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = usePurchaseOrder(orderId);

  if (isLoading || !order) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Réceptionner — ${order.code}`} />
      <div className="max-w-2xl">
        <GoodsReceiptForm order={order} />
      </div>
    </div>
  );
}
