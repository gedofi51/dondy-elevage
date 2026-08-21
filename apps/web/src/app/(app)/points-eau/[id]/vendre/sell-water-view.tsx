'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { SaleForm } from '@/features/sales/components/sale-form';

export function SellWaterView({ waterPointId }: { waterPointId: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendre de l'eau" />
      <div className="max-w-lg">
        <SaleForm
          productType="EAU"
          presetFk={{ waterPointId }}
          onSuccess={() => router.push(`/points-eau/${waterPointId}`)}
        />
      </div>
    </div>
  );
}
