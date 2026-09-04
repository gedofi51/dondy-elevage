'use client';

/**
 * Courbe de croissance (Lot Tableau de bord) — poids moyen réel par jour,
 * pour une bande de chair. Aucun composant équivalent n'existait ailleurs
 * dans le projet (recherché avant d'écrire ce fichier — aucun
 * `recharts`/`LineChart`/`<svg>` de tracé dans apps/web) : nouveau,
 * réutilisable si une future phase l'ajoute à la fiche de bande. SVG brut
 * (pas de dépendance graphique ajoutée, cohérent avec le mockup source
 * lui-même en SVG).
 *
 * Pas de ligne "Objectif" (poids cible J1-J45) : aucune donnée de
 * référence zootechnique n'existe dans le projet (recherché, voir
 * DETTE_TECHNIQUE.md Lot Tableau de bord) — en inventer une aurait été un
 * chiffre fictif, jamais affiché.
 */
export interface GrowthChartPoint {
  dayNumber: number;
  averageWeightG: number;
}

const VIEW_WIDTH = 580;
const VIEW_HEIGHT = 210;
const PADDING_LEFT = 40;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 26;
const PLOT_RIGHT = VIEW_WIDTH - 20;

export function GrowthChart({ points }: { points: GrowthChartPoint[] }) {
  const sorted = [...points].sort((a, b) => a.dayNumber - b.dayNumber);

  if (sorted.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
        Pas encore de pesée enregistrée pour cette bande.
      </p>
    );
  }

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const maxWeightG = Math.max(...sorted.map((p) => p.averageWeightG));
  const maxDay = Math.max(...sorted.map((p) => p.dayNumber), 1);
  // Marge visuelle de 15 % au-dessus du pic réel — même esprit que le
  // mockup (échelle 0 → légèrement au-dessus de la dernière valeur), pas
  // un objectif chiffré.
  const yMax = maxWeightG > 0 ? maxWeightG * 1.15 : 1;

  const plotWidth = PLOT_RIGHT - PADDING_LEFT;
  const plotHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const baselineY = PADDING_TOP + plotHeight;

  const x = (day: number) => PADDING_LEFT + (day / maxDay) * plotWidth;
  const y = (weightG: number) => PADDING_TOP + plotHeight - (weightG / yMax) * plotHeight;

  const linePoints = sorted.map((p) => `${x(p.dayNumber).toFixed(1)},${y(p.averageWeightG).toFixed(1)}`);
  const linePath = `M${linePoints.join(' L')}`;
  const areaPath = `M${x(first.dayNumber).toFixed(1)},${baselineY} L${linePoints.join(' L')} L${x(last.dayNumber).toFixed(1)},${baselineY} Z`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className="block w-full"
      style={{ height: 220 }}
      role="img"
      aria-label={`Courbe de croissance : poids moyen réel de ${(first.averageWeightG / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg à J${first.dayNumber} à ${(last.averageWeightG / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg à J${last.dayNumber}`}
    >
      <defs>
        <linearGradient id="growth-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0.22 }} />
          <stop offset="1" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <line x1={PADDING_LEFT} y1={PADDING_TOP} x2={PADDING_LEFT} y2={baselineY} className="stroke-border" />
      <line x1={PADDING_LEFT} y1={baselineY} x2={PLOT_RIGHT} y2={baselineY} className="stroke-border" />
      <path d={areaPath} fill="url(#growth-chart-fill)" />
      <path
        d={linePath}
        fill="none"
        className="stroke-accent"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(last.dayNumber)}
        cy={y(last.averageWeightG)}
        r={4.5}
        className="fill-accent stroke-card"
        strokeWidth={2}
      />
      <g className="fill-muted-foreground text-[10px]">
        <text x={PADDING_LEFT} y={VIEW_HEIGHT - 8}>
          J{first.dayNumber}
        </text>
        <text x={PLOT_RIGHT - 18} y={VIEW_HEIGHT - 8}>
          J{last.dayNumber}
        </text>
        <text x={4} y={baselineY + 3}>
          0
        </text>
        <text x={4} y={PADDING_TOP + 8}>
          {(yMax / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg
        </text>
      </g>
    </svg>
  );
}
