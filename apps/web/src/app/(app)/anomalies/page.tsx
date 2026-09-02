'use client';

import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { AlertStatus } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { AlertBadge } from '@/components/shared/alert-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAcknowledgeAlert, useAlerts } from '@/features/alerts/hooks';

/** Préfixe commun aux deux règles croisées (Broiler/Layer, voir
 * AnomalyDetectionCronService) — le suffixe (jour/date) varie par
 * détection, jamais une égalité stricte (voir useAlerts, typePrefix). */
const ANOMALY_TYPE_PREFIX = 'anomalie_croisee';

const statusLabels: Record<AlertStatus, string> = {
  CREATED: 'Créée',
  TRIGGERED: 'Déclenchée',
  ACKNOWLEDGED: 'Acquittée',
};

/**
 * Détection d'anomalies (Lot 4) — écran dédié séparé de /comparaison
 * (décision Lot 4, voir DETTE_TECHNIQUE.md) : consomme directement le
 * moteur d'alertes générique existant (GET /alerts?typePrefix=), aucune
 * route dédiée côté API. Décomposition affichée telle quelle
 * (Alert.message, une ligne par signal) — jamais un résultat opaque
 * (V6 §12 : aide à la décision, jamais un diagnostic vétérinaire).
 * RBAC : ALERTS_READ (même permission générique que le reste du moteur
 * d'alertes, aucune permission dédiée — voir DETTE_TECHNIQUE.md).
 */
export default function AnomaliesPage() {
  const { data, isLoading } = useAlerts({ typePrefix: ANOMALY_TYPE_PREFIX, limit: 100 });
  const acknowledgeMutation = useAcknowledgeAlert();
  const anomalies = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Anomalies"
        description="Anomalies détectées automatiquement en croisant plusieurs indicateurs (eau, aliment, mortalité) — une aide à la décision, jamais un diagnostic vétérinaire."
      />

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : anomalies.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune anomalie détectée pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {anomalies.map((alert) => (
            <li key={alert.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Détectée le {new Date(alert.createdAt).toLocaleString('fr-FR')}
                    {alert.triggeredAt
                      ? ` — déclenchée le ${new Date(alert.triggeredAt).toLocaleString('fr-FR')}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertBadge severity={alert.severity} />
                  <StatusBadge
                    label={statusLabels[alert.status]}
                    tone={alert.status === 'ACKNOWLEDGED' ? 'muted' : 'info'}
                  />
                </div>
              </div>

              {alert.message ? (
                <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 text-sm text-foreground">
                  {alert.message.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              ) : null}

              <Can permission={PERMISSIONS.ALERTS_ACKNOWLEDGE}>
                {alert.status === 'TRIGGERED' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => acknowledgeMutation.mutate(alert.id)}
                    disabled={acknowledgeMutation.isPending}
                  >
                    Acquitter
                  </Button>
                ) : null}
              </Can>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
