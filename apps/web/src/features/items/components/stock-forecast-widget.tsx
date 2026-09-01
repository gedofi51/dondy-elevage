'use client';

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { useItemsWithForecast } from '../hooks';

const TOP_N = 5;

/**
 * Bloc dashboard "Autonomie stock" (Lot 2) — même patron que
 * AlertsWidget (app/(app)/page.tsx) : top N, pas de seuil de gravité
 * arbitraire au-delà du tri (mêmes règles que "5 alertes les plus
 * récentes"). N'affiche que les articles à donnée SUFFISANTE — jamais un
 * chiffre inventé pour les autres (voir prompt Lot 2). Valeurs
 * explicitement marquées "≈"/"(estimé)" — distinction visuelle
 * prévisionnel/réel, règle non négociable.
 */
export function StockForecastWidget() {
  const { data, isLoading } = useItemsWithForecast();

  if (isLoading) {
    return null;
  }

  const soonest = (data ?? [])
    .filter(
      (row): row is typeof row & { forecast: NonNullable<typeof row.forecast> } =>
        row.forecast?.dataStatus === 'SUFFISANT' && row.forecast.autonomyDays !== null,
    )
    .sort((a, b) => a.forecast.autonomyDays! - b.forecast.autonomyDays!)
    .slice(0, TOP_N);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarClock className="h-4 w-4 text-info" aria-hidden="true" />
        Autonomie stock (estimée)
      </h2>
      {soonest.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Pas encore assez d’historique de mouvements pour estimer l’autonomie des articles.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {soonest.map(({ item, forecast }) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <Link href={`/stocks/${item.id}`} className="text-foreground hover:underline">
                {item.name}
              </Link>
              <span className="text-xs italic text-muted-foreground">
                ≈ {forecast.autonomyDays} j
                {forecast.estimatedStockoutDate
                  ? ` (rupture prévue le ${new Date(forecast.estimatedStockoutDate).toLocaleDateString('fr-FR')})`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
