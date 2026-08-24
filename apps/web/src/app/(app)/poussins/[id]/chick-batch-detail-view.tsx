'use client';

import Link from 'next/link';
import { Pencil, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useChickBatch } from '@/features/chick-batches/hooks';
import { chickBatchStatusConfig } from '@/features/chick-batches/components/chick-batch-table';
import { useSalesByChickBatch } from '@/features/sales/hooks';
import { SaleTable } from '@/features/sales/components/sale-table';
import { OriginCard } from '@/features/batch-lineage/components/origin-card';

const purposeLabels = { VENTE: 'Vente', RENOUVELLEMENT: 'Renouvellement' } as const;

export function ChickBatchDetailView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useChickBatch(batchId);
  const { data: sales, isLoading: salesLoading } = useSalesByChickBatch(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={batch.code}
        description={purposeLabels[batch.purpose]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={chickBatchStatusConfig[batch.status].label}
              tone={chickBatchStatusConfig[batch.status].tone}
            />
            {batch.purpose === 'VENTE' ? (
              <Can permission={PERMISSIONS.SALES_CREATE}>
                <Button nativeButton={false} render={<Link href={`/poussins/${batchId}/vendre`} />}>
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Vendre
                </Button>
              </Can>
            ) : null}
            <Can permission={PERMISSIONS.CHICK_BATCHES_UPDATE}>
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<Link href={`/poussins/${batchId}/modifier`} />}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Quantité initiale" value={batch.initialQuantity} unit="poussins" />
        <KpiCard
          label="Restant à vendre"
          value={batch.currentHeadcount != null ? batch.currentHeadcount : '—'}
          unit={batch.currentHeadcount != null ? 'poussins' : undefined}
        />
      </div>

      <Can permission={PERMISSIONS.BATCH_LINEAGE_READ}>
        <OriginCard childType="chick_batch" childId={batchId} />
      </Can>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-primary">Ventes</h2>
        {batch.purpose === 'VENTE' ? (
          <SaleTable data={sales} isLoading={salesLoading} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Lot de renouvellement — non destiné à la vente.
          </p>
        )}
      </div>
    </div>
  );
}
