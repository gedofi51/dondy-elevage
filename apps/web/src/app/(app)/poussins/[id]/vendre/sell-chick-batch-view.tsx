'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { SaleForm } from '@/features/sales/components/sale-form';

export function SellChickBatchView({ batchId }: { batchId: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendre des poussins" />
      <div className="max-w-lg">
        <SaleForm
          productType="POUSSINS"
          presetFk={{ chickBatchId: batchId }}
          customerRequired
          onSuccess={() => router.push(`/poussins/${batchId}`)}
        />
      </div>
    </div>
  );
}
