'use client';

import { Droplets, TrendingUp, Wallet, ReceiptText } from 'lucide-react';
import { KpiCard } from '@/components/shared/kpi-card';
import { Can } from '@/components/shared/permission-gate';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useWaterPointKpi } from '../hooks';

function fcfa(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

/** Gaté par WATER_READINGS_READ (pas WATER_POINTS_READ) — les KPI
 * dérivent des relevés, voir le commentaire du contrôleur API. */
export function WaterPointKpiCards({ waterPointId }: { waterPointId: string }) {
  return (
    <Can permission={PERMISSIONS.WATER_READINGS_READ}>
      <WaterPointKpiCardsContent waterPointId={waterPointId} />
    </Can>
  );
}

function WaterPointKpiCardsContent({ waterPointId }: { waterPointId: string }) {
  const { data: kpi, isLoading } = useWaterPointKpi(waterPointId, currentMonthRange());
  if (isLoading || !kpi) return null;

  const varianceTone = kpi.totalVarianceFcfa === 0 ? 'default' : kpi.totalVarianceFcfa > 0 ? 'success' : 'destructive';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Consommation (période)"
        value={kpi.totalConsumptionM3.toLocaleString('fr-FR')}
        unit="m³"
        icon={Droplets}
        tone="info"
      />
      <KpiCard label="Encaissé" value={fcfa(kpi.totalCashAmountFcfa)} icon={Wallet} />
      <KpiCard
        label="Écart caisse/théorique"
        value={fcfa(kpi.totalVarianceFcfa)}
        icon={ReceiptText}
        tone={varianceTone}
      />
      <KpiCard
        label="Marge"
        value={fcfa(kpi.grossMarginFcfa)}
        icon={TrendingUp}
        tone={kpi.grossMarginFcfa >= 0 ? 'success' : 'destructive'}
      />
    </div>
  );
}
