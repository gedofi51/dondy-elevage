import { safeDivide } from '../../../common/calculations/safe-math.util';

/**
 * Détection d'anomalies (Lot 4) — brique générique réutilisée par les
 * règles Broiler/Layer (voir broiler-anomaly.calculations.ts /
 * layer-anomaly.calculations.ts). Un "signal" compare une moyenne récente
 * à une moyenne de référence (fenêtre précédente) et expose TOUJOURS sa
 * décomposition complète (valeurs, seuil, déclenché ou non) — jamais un
 * booléen opaque, conformément au principe V6 §12 ("l'IA est une aide à
 * la décision, elle ne remplace jamais le diagnostic vétérinaire").
 */
export interface AnomalySignal {
  label: string;
  unit: string;
  recentAverage: number;
  baselineAverage: number;
  /** Signé — négatif = baisse, positif = hausse. `Infinity` si
   * baselineAverage = 0 et recentAverage > 0 (apparition d'un phénomène
   * là où il n'y en avait aucune trace — jamais représentable comme un
   * pourcentage réel, à formater explicitement, voir anomaly-message.ts). */
  changePercent: number;
  thresholdPercent: number;
  triggered: boolean;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Signal de type "baisse" (ex. eau, aliment) — déclenché si la moyenne
 * récente chute d'au moins `thresholdPercent` par rapport à la moyenne de
 * référence. `baselineAverage <= 0` -> rien de fiable à comparer, jamais
 * déclenché (pas de tendance connue, pas un chiffre inventé).
 */
export function computeDeclineSignal(
  label: string,
  unit: string,
  recentValues: number[],
  baselineValues: number[],
  thresholdPercent: number,
): AnomalySignal {
  const recentAverage = average(recentValues);
  const baselineAverage = average(baselineValues);
  const changePercent =
    baselineAverage > 0 ? safeDivide(recentAverage - baselineAverage, baselineAverage) * 100 : 0;
  const triggered = baselineAverage > 0 && changePercent <= -thresholdPercent;
  return {
    label,
    unit,
    recentAverage,
    baselineAverage,
    changePercent,
    thresholdPercent,
    triggered,
  };
}

/**
 * Signal de type "hausse" (ex. mortalité) — déclenché si la moyenne
 * récente dépasse la moyenne de référence d'au moins `thresholdPercent`.
 * Cas particulier : `baselineAverage = 0` et `recentAverage > 0` ->
 * TOUJOURS déclenché (apparition d'un phénomène là où il n'y en avait
 * aucune trace — un simple `safeDivide` donnerait 0 %, ce qui masquerait
 * l'anomalie la plus parlante de toutes).
 */
export function computeIncreaseSignal(
  label: string,
  unit: string,
  recentValues: number[],
  baselineValues: number[],
  thresholdPercent: number,
): AnomalySignal {
  const recentAverage = average(recentValues);
  const baselineAverage = average(baselineValues);
  let changePercent: number;
  let triggered: boolean;
  if (baselineAverage > 0) {
    changePercent = safeDivide(recentAverage - baselineAverage, baselineAverage) * 100;
    triggered = changePercent >= thresholdPercent;
  } else if (recentAverage > 0) {
    changePercent = Infinity;
    triggered = true;
  } else {
    changePercent = 0;
    triggered = false;
  }
  return {
    label,
    unit,
    recentAverage,
    baselineAverage,
    changePercent,
    thresholdPercent,
    triggered,
  };
}
