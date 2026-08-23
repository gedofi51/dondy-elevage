'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { SaleForm } from '@/features/sales/components/sale-form';

export function SellBroilerBatchView({ batchId }: { batchId: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendre des poulets" />
      <div className="max-w-lg">
        <SaleForm
          productType="POULET_CHAIR"
          presetFk={{ batchId }}
          customerRequired
          onSuccess={() => router.push(`/poulets-chair/${batchId}`)}
        />
      </div>
    </div>
  );
}
