'use client';

import { KpiCard } from '@/components/shared/kpi-card';
import { useTreasuryForecast } from '@/features/treasury/hooks';

function formatFcfa(value: number | undefined): string {
  return value != null ? `${value.toLocaleString('fr-FR')} FCFA` : '—';
}

/**
 * Prévisions finance (Lot 3). Comparatif prévu/réalisé sans persistance
 * (décision Lot 3, voir DETTE_TECHNIQUE.md) : "réalisé" = trésorerie réelle
 * depuis le 1er du mois courant à aujourd'hui (TreasuryService.getSummary,
 * même définition que /tresorerie) ; "projeté" = extrapolation linéaire
 * sur le reste du mois, jamais mélangée visuellement au réalisé — deux
 * rangées de KpiCard distinctes, la seconde entièrement en italique avec
 * libellé "(estimé)", jamais un chiffre inventé si la donnée est
 * insuffisante (< 3 jours écoulés dans le mois).
 */
export function FinanceForecastCard() {
  const { data: forecast, isLoading } = useTreasuryForecast();

  if (isLoading || !forecast) {
    return null;
  }

  const periodLabel = new Date(forecast.periodStart).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Mois en cours ({periodLabel}) — {forecast.daysElapsed} / {forecast.daysTotal} jours écoulés.
        Calculé le {new Date(forecast.calculatedAt).toLocaleString('fr-FR')}.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Réalisé depuis le 1er du mois</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Chiffre d’affaires" value={formatFcfa(forecast.realized.revenueFcfa)} />
          <KpiCard label="Charges" value={formatFcfa(forecast.realized.totalExpensesFcfa)} />
          <KpiCard
            label="Trésorerie nette"
            value={formatFcfa(forecast.realized.netTreasuryFcfa)}
            tone={forecast.realized.netTreasuryFcfa < 0 ? 'destructive' : 'success'}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">
          Projeté fin de mois <span className="italic text-muted-foreground">(estimé)</span>
        </h3>
        {forecast.dataStatus === 'INSUFFISANT' || !forecast.projected ? (
          <p className="text-sm text-muted-foreground">
            Pas encore assez de jours écoulés ce mois-ci pour projeter une fin de mois fiable.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 italic sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard label="CA prévisionnel" value={formatFcfa(forecast.projected.revenueFcfa)} />
            <KpiCard label="Charges prévues" value={formatFcfa(forecast.projected.totalExpensesFcfa)} />
            <KpiCard label="Marge prévisionnelle" value={formatFcfa(forecast.projected.grossMarginFcfa)} />
            <KpiCard
              label="Rentabilité prévisionnelle"
              value={`${forecast.projected.profitabilityRate.toFixed(1)} %`}
            />
            <KpiCard
              label="Besoin de trésorerie prévu"
              value={formatFcfa(forecast.projected.netTreasuryFcfa)}
              tone={forecast.projected.netTreasuryFcfa < 0 ? 'destructive' : 'success'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
