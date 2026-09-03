import { safeDivide } from './safe-math.util';

/**
 * Score de performance (Lot 5, IA) — mathématiques de pondération
 * mutualisées entre Chair/Pondeuses/Couvoir (3 usages dès ce lot, doctrine
 * du projet : mutualiser au 2e/3e usage, pas avant — voir
 * opaque-token.util.ts pour le précédent). Chaque module métier ne fait
 * que fournir SES composantes (valeur brute, sens d'amélioration, poids,
 * cible éventuelle) ; ce fichier ne connaît aucune notion de bande/lot.
 *
 * Principe non négociable (prompt Lot 5) : jamais un score opaque —
 * chaque composante reste individuellement visible dans la décomposition,
 * avec sa contribution ; jamais un chiffre inventé — une composante sans
 * donnée (ou sans cible configurée pour un indicateur qui en a besoin)
 * contribue `null`, exclue du calcul plutôt que remplacée par une valeur
 * par défaut arbitraire.
 */
export type ScoreDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';

/**
 * Types communs à Chair/Pondeuses/Couvoir — définis ici une seule fois
 * (pas dans chaque `*-performance-score.calculations.ts`) pour éviter 3
 * copies internes à apps/api. `packages/shared-types` porte sa propre
 * copie pour le contrat API/frontend (même convention que
 * `ItemForecast`/`ForecastDataStatus`, Lot 2 : le calcul pur d'apps/api et
 * le contrat partagé restent deux sources indépendantes, synonymes par
 * convention).
 */
export type ScoreDataStatus = 'SUFFISANT' | 'INSUFFISANT';

/** Coefficient d'une composante : poids obligatoire, `target` uniquement
 * pour les composantes sans échelle 0-100 naturelle (GMQ, IC) — absent =
 * composante exclue du score (voir contributionFromRatioToTarget). */
export interface PerformanceScoreCoefficient {
  weight: number;
  target?: number;
}

export type PerformanceScoreCoefficients = Record<string, PerformanceScoreCoefficient>;

export interface PerformanceScoreComponent {
  key: string;
  label: string;
  rawValue: number | null;
  unit: string;
  target: number | null;
  weight: number;
  contributionPercent: number | null;
}

export interface BatchPerformanceScore {
  scoreOn100: number | null;
  dataStatus: ScoreDataStatus;
  components: PerformanceScoreComponent[];
  calculatedAt: string;
}

/**
 * Convertit un DTO à champs nommés (voir
 * broiler-batches/dto/update-broiler-performance-coefficients.dto.ts) en
 * `PerformanceScoreCoefficients` (map par clé de composante), en écartant
 * les champs non fournis — les 3 DTO (Chair/Pondeuses/Couvoir) partagent
 * tous la forme `{ weight, target? }` par composante, seul le nom des
 * champs change. `dto: object` plutôt que `Record<string, unknown>` : les
 * DTO à champs nommés n'ont pas de signature d'index — `object` est le
 * seul type qui les accepte sans cast au point d'appel, tout en gardant
 * `Object.entries` utilisable ci-dessous (aucun cast `as` non justifié :
 * le seul cast du corps est un rétrécissement de type après vérification
 * `'weight' in raw`, pas une conversion de frontière non vérifiée).
 */
export function coefficientsFromDto(dto: object): PerformanceScoreCoefficients {
  const result: PerformanceScoreCoefficients = {};
  for (const [key, raw] of Object.entries(dto)) {
    if (raw && typeof raw === 'object' && 'weight' in raw) {
      const value = raw as { weight: number; target?: number };
      result[key] =
        value.target !== undefined
          ? { weight: value.weight, target: value.target }
          : { weight: value.weight };
    }
  }
  return result;
}

/**
 * Convertit un taux déjà exprimé en pourcentage (0-100, ex. taux de
 * mortalité, taux de ponte, taux d'éclosion) en contribution 0-100 au
 * score : directement le taux si "plus haut = meilleur" (ponte, éclosion),
 * ou son complément à 100 si "plus bas = meilleur" (mortalité). Bornée
 * [0, 100] — un taux hors bornes (donnée aberrante en amont) ne doit
 * jamais produire une contribution hors échelle.
 */
export function contributionFromRatePercent(
  ratePercent: number,
  direction: ScoreDirection,
): number {
  const clamped = Math.min(100, Math.max(0, ratePercent));
  return direction === 'HIGHER_IS_BETTER' ? clamped : 100 - clamped;
}

/**
 * Convertit une valeur brute sans échelle 0-100 naturelle (GMQ en g/j, IC
 * sans unité) en contribution 0-100, relativement à une CIBLE — cible
 * elle-même fournie par l'appelant (jamais une constante inventée ici,
 * voir DETTE_TECHNIQUE.md Lot 5 : aucune cible zootechnique n'est
 * documentée dans le cahier des charges, donc aucune valeur par défaut
 * n'est inventée — la cible est paramétrable via `Setting`, absente =
 * composante exclue, voir buildScoreComponent). `target <= 0` traité
 * comme non configuré (contribution non calculable), pas une division
 * par zéro silencieuse à 0.
 */
export function contributionFromRatioToTarget(
  actual: number,
  target: number,
  direction: ScoreDirection,
): number | null {
  if (target <= 0) {
    return null;
  }
  const ratio =
    direction === 'HIGHER_IS_BETTER' ? safeDivide(actual, target) : safeDivide(target, actual);
  return Math.min(100, Math.max(0, ratio * 100));
}

export interface ScoreComponentInput {
  key: string;
  /** Poids configuré (`Setting`, ou défaut) — jamais négatif, une valeur
   * négative saisie par erreur est traitée comme 0 (composante neutralisée
   * plutôt qu'elle n'inverse le score). */
  weight: number;
  /** `null` si la composante n'a pas pu être calculée (donnée insuffisante
   * OU cible non configurée pour gmq/ic) — exclue du score pondéré,
   * jamais remplacée par 0 (0 laisserait croire à une contre-performance
   * réelle). */
  contributionPercent: number | null;
}

/**
 * Moyenne pondérée des contributions réellement disponibles, poids
 * renormalisés sur les seules composantes utilisables (une composante
 * absente ne doit ni pénaliser ni avantager silencieusement le score —
 * elle est simplement retirée du calcul, comme un signal manquant au Lot 4
 * qui ne se moyenne jamais sur une valeur absente). `null` si aucune
 * composante n'est utilisable (jamais 0, qui se lirait comme "pire score
 * possible" plutôt que "aucune donnée").
 */
export function computeWeightedScore(components: ScoreComponentInput[]): number | null {
  const usable = components.filter(
    (c) => c.contributionPercent !== null && Math.max(0, c.weight) > 0,
  );
  const totalWeight = usable.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
  if (totalWeight <= 0) {
    return null;
  }
  const weightedSum = usable.reduce(
    (sum, c) => sum + c.contributionPercent! * Math.max(0, c.weight),
    0,
  );
  return weightedSum / totalWeight;
}
