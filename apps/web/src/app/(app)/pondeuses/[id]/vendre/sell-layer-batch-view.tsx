'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { SaleForm } from '@/features/sales/components/sale-form';

export function SellLayerBatchView({ batchId }: { batchId: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendre des œufs" />
      <div className="max-w-lg">
        <SaleForm
          productType="OEUFS"
          presetFk={{ layerBatchId: batchId }}
          customerRequired
          onSuccess={() => router.push(`/pondeuses/${batchId}`)}
        />
      </div>
    </div>
  );
}
