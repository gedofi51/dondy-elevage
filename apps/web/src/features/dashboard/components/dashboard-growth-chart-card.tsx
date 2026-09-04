'use client';

import type { Alert, AlertSeverity, BroilerBatchWithComputed } from '@dondy-elevage/shared-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useDailyRecords } from '@/features/broiler-batches/hooks';
import { GrowthChart } from '@/features/broiler-batches/components/growth-chart';

const ACTIVE_BROILER_STATUSES = new Set([
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
]);

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITIQUE: 3, IMPORTANT: 2, VIGILANCE: 1, INFO: 0 };

/** Bande mise en avant par défaut (prompt : "la plus critique/en alerte,
 * sinon la plus récente") — "en alerte" = référencée par une alerte
 * TRIGGERED active (moteur d'alertes Phase 11, déjà chargé pour
 * AlertsPanel, aucun fetch supplémentaire), départagée par sévérité ; à
 * défaut, la bande active arrivée le plus récemment. Scope Chair
 * uniquement : le suivi de poids quotidien (J1-J45) n'existe que pour ce
 * type — les Pondeuses n'ont pas d'équivalent quotidien comparable. */
export function selectFeaturedBroilerBatch(
  activeBatches: BroilerBatchWithComputed[],
  alerts: Alert[],
): BroilerBatchWithComputed | undefined {
  if (activeBatches.length === 0) return undefined;

  const alertedIds = new Map<string, AlertSeverity>();
  for (const alert of alerts) {
    if (alert.entityType !== 'broiler_batch' || alert.entityId === null) continue;
    const current = alertedIds.get(alert.entityId);
    if (!current || SEVERITY_RANK[alert.severity] > SEVERITY_RANK[current]) {
      alertedIds.set(alert.entityId, alert.severity);
    }
  }

  const alertedBatches = activeBatches.filter((b) => alertedIds.has(b.id));
  if (alertedBatches.length > 0) {
    return [...alertedBatches].sort(
      (a, b) => SEVERITY_RANK[alertedIds.get(b.id)!] - SEVERITY_RANK[alertedIds.get(a.id)!],
    )[0];
  }

  return [...activeBatches].sort(
    (a, b) => new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime(),
  )[0];
}

/**
 * Courbe de croissance (maquette 1a) — bande mise en avant choisie par
 * `selectFeaturedBroilerBatch`, poids réel issu des pesées déjà saisies
 * (`useDailyRecords`, même hook que la fiche de bande). Pas de ligne
 * "Objectif" — voir growth-chart.tsx.
 */
export function DashboardGrowthChartCard({
  broilerBatches,
  alerts,
}: {
  broilerBatches: BroilerBatchWithComputed[] | undefined;
  alerts: Alert[];
}) {
  const activeBatches = (broilerBatches ?? []).filter((b) => ACTIVE_BROILER_STATUSES.has(b.status));
  const featured = selectFeaturedBroilerBatch(activeBatches, alerts);
  const { data: dailyRecords } = useDailyRecords(featured?.id ?? '');

  const points = (dailyRecords ?? [])
    .filter((r) => r.averageWeightG !== null)
    .map((r) => ({ dayNumber: r.dayNumber, averageWeightG: r.averageWeightG! }));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-primary">Courbe de croissance</h2>
          <p className="text-xs text-muted-foreground">
            Poids moyen réel
            {featured ? ` · Bande ${featured.code} (chair)` : ''}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="h-0.5 w-3.5 rounded-full bg-accent" />
          Réel
        </span>
      </CardHeader>
      <CardContent>
        {featured ? (
          <GrowthChart points={points} />
        ) : (
          <p className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
            Aucune bande de chair active pour le moment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
