'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { EntityAlertsWidget } from '@/components/shared/entity-alerts-widget';
import { QrCodePanel } from '@/features/qr-codes/components/qr-code-panel';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useItem } from '@/features/items/hooks';
import { stockStatusConfig } from '@/features/items/components/item-table';
import { useStockMovements } from '@/features/stock-movements/hooks';
import { StockMovementTable } from '@/features/stock-movements/components/stock-movement-table';
import { StockMovementCreateDialog } from '@/features/stock-movements/components/stock-movement-create-dialog';

export function ItemDetailView({ itemId }: { itemId: string }) {
  const { data: item, isLoading } = useItem(itemId);
  const { data: movements, isLoading: movementsLoading } = useStockMovements(itemId);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);

  if (isLoading || !item) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={item.name}
        description={item.category}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={stockStatusConfig[item.status].label} tone={stockStatusConfig[item.status].tone} />
            <Can permission={PERMISSIONS.ITEMS_UPDATE}>
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<Link href={`/stocks/${itemId}/modifier`} />}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        }
      />

      <EntityAlertsWidget entityId={itemId} />
      <QrCodePanel
        apiSegment="items"
        entityId={itemId}
        readPermission={PERMISSIONS.ITEMS_READ}
        updatePermission={PERMISSIONS.ITEMS_UPDATE}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Stock actuel"
          value={Number(item.currentStock).toLocaleString('fr-FR')}
          unit={item.unit}
        />
        <KpiCard
          label="Seuil minimum"
          value={item.minThreshold ? Number(item.minThreshold).toLocaleString('fr-FR') : '—'}
          unit={item.minThreshold ? item.unit : undefined}
        />
        <KpiCard label="Coût moyen pondéré" value={item.averageUnitCostFcfa.toLocaleString('fr-FR')} unit="FCFA" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-primary">Mouvements</h2>
          <Can permission={PERMISSIONS.STOCK_MOVEMENTS_CREATE}>
            <Button size="sm" variant="outline" onClick={() => setMovementDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau mouvement
            </Button>
          </Can>
        </div>
        <Can
          permission={PERMISSIONS.STOCK_MOVEMENTS_READ}
          fallback={<p className="text-sm text-muted-foreground">Non disponible avec votre rôle actuel.</p>}
        >
          <StockMovementTable data={movements} isLoading={movementsLoading} />
        </Can>
      </div>

      <StockMovementCreateDialog itemId={itemId} open={movementDialogOpen} onOpenChange={setMovementDialogOpen} />
    </div>
  );
}
