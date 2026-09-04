'use client';

import { Droplets, Sun, Wifi } from 'lucide-react';
import type { Asset } from '@dondy-elevage/shared-types';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Can } from '@/components/shared/permission-gate';
import { cn } from '@/lib/utils';
import { useInfrastructureStatusSummary } from '@/features/infrastructure/hooks';

const NETWORK_STATUS_LABEL: Record<string, string> = {
  OPERATIONNEL: 'Connecté',
  DEGRADE: 'Dégradé',
  HORS_LIGNE: 'Hors ligne',
};
const NETWORK_STATUS_DOT: Record<string, string> = {
  OPERATIONNEL: 'bg-success',
  DEGRADE: 'bg-warning',
  HORS_LIGNE: 'bg-destructive',
};

function levelTone(percent: number): { text: string; bar: string } {
  if (percent < 25) return { text: 'text-destructive', bar: 'bg-destructive' };
  if (percent < 50) return { text: 'text-warning', bar: 'bg-warning' };
  return { text: 'text-success', bar: 'bg-success' };
}

function LevelRow({
  icon: Icon,
  label,
  percent,
}: {
  icon: typeof Droplets;
  label: string;
  percent: number | null;
}) {
  const tone = percent !== null ? levelTone(percent) : null;
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          {percent !== null ? (
            <span
              className={cn('block h-full', tone!.bar)}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          ) : null}
        </div>
      </div>
      <span className={cn('shrink-0 text-xs font-semibold', tone?.text ?? 'text-muted-foreground')}>
        {percent !== null ? `${percent.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %` : '—'}
      </span>
    </div>
  );
}

/**
 * Infrastructures (maquette 1a) — reprend les données Phase 18/19 (un
 * asset par catégorie 'eau'/'solaire'/'internet', dernier relevé). Gaté
 * ASSETS_READ (nécessaire pour identifier les assets — même contrainte
 * pré-existante que la fiche actif, voir DETTE_TECHNIQUE.md), chaque
 * ligne individuellement gatée par sa propre permission de lecture de
 * relevé (un rôle "Responsable eau" par ex. n'a pas ASSETS_READ
 * aujourd'hui — caractéristique RBAC déjà existante, pas une régression
 * introduite ici).
 */
export function DashboardInfrastructurePanel({ assets }: { assets: Asset[] | undefined }) {
  const summary = useInfrastructureStatusSummary(assets);

  const hasAnyLine = summary.water || summary.solar || summary.network;
  if (!hasAnyLine && !summary.isLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Infrastructures</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Can permission={PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_READ}>
          {summary.water ? (
            <LevelRow
              icon={Droplets}
              label="Eau · Forage + réserve"
              percent={
                summary.water.latestReading?.reservoirLevelPercent != null
                  ? Number(summary.water.latestReading.reservoirLevelPercent)
                  : null
              }
            />
          ) : null}
        </Can>
        <Can permission={PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_READ}>
          {summary.solar ? (
            <LevelRow
              icon={Sun}
              label="Énergie · Solaire + batteries"
              percent={
                summary.solar.latestReading?.batteryChargePercent != null
                  ? Number(summary.solar.latestReading.batteryChargePercent)
                  : null
              }
            />
          ) : null}
        </Can>
        <Can permission={PERMISSIONS.NETWORK_STATUS_READINGS_READ}>
          {summary.network ? (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                <Wifi className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Internet</p>
                <p className="text-xs text-muted-foreground">
                  {summary.network.latestReading
                    ? NETWORK_STATUS_LABEL[summary.network.latestReading.operationalStatus]
                    : 'Aucun relevé récent'}
                </p>
              </div>
              {summary.network.latestReading ? (
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    NETWORK_STATUS_DOT[summary.network.latestReading.operationalStatus],
                  )}
                />
              ) : null}
            </div>
          ) : null}
        </Can>
      </CardContent>
    </Card>
  );
}
