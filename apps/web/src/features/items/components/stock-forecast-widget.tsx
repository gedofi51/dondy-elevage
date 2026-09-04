'use client';

import Link from 'next/link';
import { useItemsWithForecast } from '../hooks';

const TOP_N = 5;

/** Ton du nombre de jours basé sur `item.status` (VERT/ORANGE/ROUGE,
 * seuil d'alerte réel — Phase 2/Lot 2), jamais un palier de jours
 * inventé pour cette carte. */
const STATUS_TONE: Record<string, string> = {
  ROUGE: 'text-destructive',
  ORANGE: 'text-warning',
  VERT: 'text-success',
};

/**
 * "Stocks critiques" (maquette 1a, Lot Tableau de bord) — même donnée que
 * l'ancien "Autonomie stock (estimée)" (Lot 2, `useItemsWithForecast`),
 * restylé fond primary plein pour matcher la maquette. Restreint aux
 * articles déjà en alerte réelle (`status !== 'VERT'`, seuil serveur) —
 * pas seulement les 5 plus proches de la rupture toutes sévérités
 * confondues, pour rester fidèle au libellé "critiques". N'affiche que
 * les articles à donnée SUFFISANTE — jamais un chiffre inventé pour les
 * autres (voir prompt Lot 2). "Créer une commande d'achat" navigue vers
 * la vraie route de création (`/achats/nouveau`), aucun pré-remplissage
 * inventé.
 */
export function StockForecastWidget() {
  const { data, isLoading } = useItemsWithForecast();

  if (isLoading) {
    return null;
  }

  const critical = (data ?? [])
    .filter(
      (row): row is typeof row & { forecast: NonNullable<typeof row.forecast> } =>
        row.forecast?.dataStatus === 'SUFFISANT' &&
        row.forecast.autonomyDays !== null &&
        row.item.status !== 'VERT',
    )
    .sort((a, b) => a.forecast.autonomyDays! - b.forecast.autonomyDays!)
    .slice(0, TOP_N);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-primary p-5 text-primary-foreground shadow-card">
      <h2 className="font-heading text-lg font-semibold">Stocks critiques</h2>
      {critical.length === 0 ? (
        <p className="text-sm text-primary-foreground/70">Aucun article en alerte de stock actuellement.</p>
      ) : (
        <ul className="flex flex-col">
          {critical.map(({ item, forecast }, index) => (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 py-2.5 text-sm ${
                index > 0 ? 'border-t border-primary-foreground/10' : ''
              }`}
            >
              <Link href={`/stocks/${item.id}`} className="text-primary-foreground hover:underline">
                {item.name}
              </Link>
              <span className={`font-semibold ${STATUS_TONE[item.status]}`}>
                {forecast.autonomyDays} j
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/achats/nouveau"
        className="mt-1 flex w-full items-center justify-center rounded-lg bg-accent px-3 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent/90"
      >
        Créer une commande d’achat
      </Link>
    </section>
  );
}
