'use client';

import Link from 'next/link';
import { Pencil, ShoppingCart, Gauge } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useWaterPoint, useWaterReadings } from '@/features/water-points/hooks';
import { useSalesByWaterPoint } from '@/features/sales/hooks';
import { WaterPointKpiCards } from '@/features/water-points/components/water-point-kpi-cards';
import { SaleTable } from '@/features/sales/components/sale-table';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import type { WaterReading, WaterPointStatus } from '@dondy-elevage/shared-types';

const statusConfig: Record<WaterPointStatus, { label: string; tone: 'success' | 'muted' | 'warning' }> = {
  ACTIF: { label: 'Actif', tone: 'success' },
  SUSPENDU: { label: 'Suspendu', tone: 'muted' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
};

export function WaterPointDetailView({ waterPointId }: { waterPointId: string }) {
  const { data: waterPoint, isLoading } = useWaterPoint(waterPointId);
  const { data: readings, isLoading: readingsLoading } = useWaterReadings(waterPointId);
  const { data: sales, isLoading: salesLoading } = useSalesByWaterPoint(waterPointId);

  if (isLoading || !waterPoint) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const readingColumns: DataTableColumn<WaterReading>[] = [
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('fr-FR') },
    { key: 'indexMatin', header: 'Index matin', render: (r) => r.indexMatin },
    { key: 'indexSoir', header: 'Index soir', render: (r) => r.indexSoir },
    { key: 'consumptionM3', header: 'Consommation (m³)', render: (r) => r.consumptionM3 },
    {
      key: 'cashAmountFcfa',
      header: 'Encaissé',
      render: (r) => `${r.cashAmountFcfa.toLocaleString('fr-FR')} FCFA`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={waterPoint.name}
        description={`Code ${waterPoint.code}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge
              label={statusConfig[waterPoint.status].label}
              tone={statusConfig[waterPoint.status].tone}
            />
            <Can permission={PERMISSIONS.WATER_READINGS_CREATE}>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/points-eau/${waterPointId}/relever`} />}
              >
                <Gauge className="h-4 w-4" aria-hidden="true" />
                Relever
              </Button>
            </Can>
            <Can permission={PERMISSIONS.SALES_CREATE}>
              <Button nativeButton={false} render={<Link href={`/points-eau/${waterPointId}/vendre`} />}>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Vendre
              </Button>
            </Can>
            <Can permission={PERMISSIONS.WATER_POINTS_UPDATE}>
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<Link href={`/points-eau/${waterPointId}/modifier`} />}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        }
      />

      <WaterPointKpiCards waterPointId={waterPointId} />

      <Tabs defaultValue="releves">
        <TabsList>
          <TabsTrigger value="releves">Relevés</TabsTrigger>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
        </TabsList>
        <TabsContent value="releves">
          <DataTable
            columns={readingColumns}
            data={readings}
            isLoading={readingsLoading}
            getRowKey={(r) => r.id}
            emptyLabel="Aucun relevé pour le moment."
          />
        </TabsContent>
        <TabsContent value="ventes">
          <SaleTable data={sales} isLoading={salesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
