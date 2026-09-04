'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { Alert, AlertSeverity } from '@dondy-elevage/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SEVERITY_STYLE: Record<AlertSeverity, { border: string; bg: string; icon: string }> = {
  CRITIQUE: { border: 'border-destructive', bg: 'bg-destructive/10', icon: 'text-destructive' },
  IMPORTANT: { border: 'border-warning', bg: 'bg-warning/10', icon: 'text-warning' },
  VIGILANCE: { border: 'border-warning', bg: 'bg-warning/10', icon: 'text-warning' },
  INFO: { border: 'border-info', bg: 'bg-info/10', icon: 'text-info' },
};

/**
 * Panneau Alertes (maquette 1a) — reprend le moteur d'alertes existant
 * (Phase 11, `GET /alerts?status=TRIGGERED`), même liste que l'ancien
 * AlertsWidget (extrait de page.tsx pour être testable et partagé avec la
 * sélection de la bande mise en avant, voir dashboard-growth-chart-card).
 * `id="alertes"` : cible de la cloche de notifications de l'en-tête.
 */
export function DashboardAlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <Card id="alertes">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Alertes</CardTitle>
        {alerts.length > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
            {alerts.length}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alerte active.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {alerts.map((alert) => {
              const style = SEVERITY_STYLE[alert.severity];
              const Icon = alert.severity === 'INFO' ? Info : AlertTriangle;
              return (
                <li
                  key={alert.id}
                  className={cn('flex gap-3 rounded-lg border-l-[3px] p-3', style.border, style.bg)}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.icon)} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                    {alert.message ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {alert.message.split('\n')[0]}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
