'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import type {
  Alert,
  AlertSeverity,
  BatchClosureSummary,
  BroilerBatchWithComputed,
  LayerBatchClosureSummary,
  LayerBatchWithComputed,
} from '@dondy-elevage/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useApiFetch } from '@/lib/api/use-api-fetch';
import { computeDayNumber } from '@/features/broiler-batches/day-number';
import { computeCurrentAgeWeeks } from '@/features/layer-batches/age';

const ACTIVE_BROILER_STATUSES = new Set([
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
]);
const ACTIVE_LAYER_STATUSES = new Set(['ELEVAGE', 'PONTE']);

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITIQUE: 3, IMPORTANT: 2, VIGILANCE: 1, INFO: 0 };
const SEVERITY_TONE: Record<AlertSeverity, 'destructive' | 'warning' | 'info'> = {
  CRITIQUE: 'destructive',
  IMPORTANT: 'warning',
  VIGILANCE: 'warning',
  INFO: 'info',
};
const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  CRITIQUE: 'Critique',
  IMPORTANT: 'Important',
  VIGILANCE: 'Vigilance',
  INFO: 'Info',
};

/** Même queryKey que useBatchProfitability/useLayerBatchProfitability
 * (features/*-batches/hooks) — cache React Query partagé, même patron que
 * comparaison/*-comparison.tsx (Lot 4). */
function useBroilerProfitabilities(ids: string[]) {
  const apiFetch = useApiFetch();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['broiler-batches', id, 'profitability'],
      queryFn: () => apiFetch<BatchClosureSummary>(`/broiler-batches/${id}/profitability`),
    })),
  });
}

function useLayerProfitabilities(ids: string[]) {
  const apiFetch = useApiFetch();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['layer-batches', id, 'profitability'],
      queryFn: () => apiFetch<LayerBatchClosureSummary>(`/layer-batches/${id}/profitability`),
    })),
  });
}

interface BatchRow {
  id: string;
  href: string;
  code: string;
  typeLabel: string;
  age: string;
  headcount: number;
  mortalityRatePercent: number | undefined;
  /** `null` = pas de donnée réelle pour ce type (Pondeuses : aucun champ
   * de poids sur LayerDailyRecord, recherché avant d'écrire ce fichier —
   * jamais un chiffre inventé), `undefined` = pas encore chargé. */
  weightKg: number | null | undefined;
  alertSeverity: AlertSeverity | undefined;
}

/** Le badge de statut le plus sévère parmi les alertes actives déjà
 * référencées sur cette bande — réutilise l'engine d'alertes (Phase 11),
 * pas une notion de statut séparée ("Vaccin J+1" du mockup n'est qu'un
 * exemple d'alerte parmi d'autres types possibles, tous couverts ici). */
function alertFor(alerts: Alert[], entityType: string, entityId: string): Alert | undefined {
  return alerts
    .filter((a) => a.entityType === entityType && a.entityId === entityId)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
}

/**
 * "État des bandes" (maquette 1a) — combine Chair et Pondeuses actives
 * dans un seul tableau. Mortalité/Poids par ligne nécessitent
 * `GET /:id/profitability` par bande active (même coût réseau que
 * `/comparaison`, borné par le nombre de bandes actives d'une ferme —
 * arbitrage déjà assumé au Lot 4).
 *
 * "Voir tout →" (maquette, lien unique) n'a pas d'équivalent réel : Chair
 * et Pondeuses sont deux listes distinctes (`/poulets-chair`,
 * `/pondeuses`), aucune liste combinée n'existe dans le projet — remplacé
 * par deux liens explicites plutôt qu'un lien unique arbitraire.
 */
export function DashboardBatchesTable({
  broilerBatches,
  layerBatches,
  alerts,
}: {
  broilerBatches: BroilerBatchWithComputed[] | undefined;
  layerBatches: LayerBatchWithComputed[] | undefined;
  alerts: Alert[];
}) {
  const activeBroiler = (broilerBatches ?? []).filter((b) => ACTIVE_BROILER_STATUSES.has(b.status));
  const activeLayer = (layerBatches ?? []).filter((b) => ACTIVE_LAYER_STATUSES.has(b.status));

  const broilerProfitabilities = useBroilerProfitabilities(activeBroiler.map((b) => b.id));
  const layerProfitabilities = useLayerProfitabilities(activeLayer.map((b) => b.id));

  const rows: BatchRow[] = [
    ...activeBroiler.map((batch, index): BatchRow => {
      const profitability = broilerProfitabilities[index]?.data;
      return {
        id: batch.id,
        href: `/poulets-chair/${batch.id}`,
        code: batch.code,
        typeLabel: 'chair',
        age: `J${computeDayNumber(batch.arrivalDate)}`,
        headcount: batch.currentHeadcount,
        mortalityRatePercent: profitability?.performance.cumulativeMortalityRate,
        weightKg:
          profitability === undefined
            ? undefined
            : profitability.performance.finalAverageWeightG !== null
              ? profitability.performance.finalAverageWeightG / 1000
              : null,
        alertSeverity: alertFor(alerts, 'broiler_batch', batch.id)?.severity,
      };
    }),
    ...activeLayer.map((batch, index): BatchRow => {
      const profitability = layerProfitabilities[index]?.data;
      return {
        id: batch.id,
        href: `/pondeuses/${batch.id}`,
        code: batch.code,
        typeLabel: 'ponte',
        age: `S${computeCurrentAgeWeeks(batch.entryDate, batch.ageAtEntryWeeks, batch.ageAtEntryDays)}`,
        headcount: batch.currentHeadcount,
        mortalityRatePercent: profitability?.performance.cumulativeMortalityRate,
        weightKg: null,
        alertSeverity: alertFor(alerts, 'layer_batch', batch.id)?.severity,
      };
    }),
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>État des bandes</CardTitle>
        <div className="flex gap-3 text-xs font-semibold text-secondary">
          <Link href="/poulets-chair" className="hover:underline">
            Chair →
          </Link>
          <Link href="/pondeuses" className="hover:underline">
            Pondeuses →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune bande active pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bande</TableHead>
                  <TableHead>Âge</TableHead>
                  <TableHead>Effectif</TableHead>
                  <TableHead>Mortalité</TableHead>
                  <TableHead>Poids</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link href={row.href} className="hover:underline">
                        {row.code}
                      </Link>{' '}
                      <span className="font-normal text-muted-foreground">{row.typeLabel}</span>
                    </TableCell>
                    <TableCell>{row.age}</TableCell>
                    <TableCell>{row.headcount.toLocaleString('fr-FR')}</TableCell>
                    <TableCell
                      className={
                        row.mortalityRatePercent !== undefined && row.mortalityRatePercent > 2
                          ? 'font-semibold text-destructive'
                          : undefined
                      }
                    >
                      {row.mortalityRatePercent !== undefined
                        ? `${row.mortalityRatePercent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {row.weightKg !== null && row.weightKg !== undefined
                        ? `${row.weightKg.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {row.alertSeverity ? (
                        <StatusBadge
                          label={SEVERITY_LABEL[row.alertSeverity]}
                          tone={SEVERITY_TONE[row.alertSeverity]}
                        />
                      ) : (
                        <StatusBadge label="Normal" tone="success" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
