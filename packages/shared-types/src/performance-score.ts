/**
 * Score de performance (Lot 5, IA) — décomposition explicite obligatoire,
 * jamais un score opaque (voir DETTE_TECHNIQUE.md). Contrat commun à
 * Chair/Pondeuses/Couvoir : seule la liste des clés de composante change
 * par type (`mortality`/`ic`/`gmq` en Chair, `mortality`/`layingRate` en
 * Pondeuses, `hatchRate`/`fertilityRate` en Couvoir — voir chaque
 * `*-performance-score.calculations.ts` côté apps/api, source de vérité
 * pure dupliquée ici par convention, même principe que
 * `ItemForecast`/`ForecastDataStatus`, Lot 2).
 */
export type ScoreDataStatus = 'SUFFISANT' | 'INSUFFISANT';

export interface PerformanceScoreComponent {
  key: string;
  label: string;
  /** `null` si non calculable (donnée insuffisante, ou cible non
   * configurée pour une composante qui en a besoin — GMQ/IC). */
  rawValue: number | null;
  unit: string;
  /** Uniquement pertinent pour GMQ/IC (Chair) — `null` sinon, ou si non
   * configurée. */
  target: number | null;
  weight: number;
  /** `null` = composante exclue du score pondéré, jamais un 0 inventé. */
  contributionPercent: number | null;
}

export interface BatchPerformanceScore {
  scoreOn100: number | null;
  dataStatus: ScoreDataStatus;
  components: PerformanceScoreComponent[];
  /** ISO complet — date de calcul, à afficher systématiquement avec le
   * résultat (même exigence que les prévisions Lot 2/3). */
  calculatedAt: string;
}

export interface PerformanceScoreCoefficient {
  weight: number;
  /** Uniquement pour les composantes GMQ/IC (Chair) — absent = composante
   * exclue du score, jamais une cible zootechnique inventée côté serveur. */
  target?: number;
}

/** Corps de `PUT .../performance-coefficients` — un champ optionnel par
 * composante connue du type de bande (voir chaque
 * `Update*PerformanceCoefficientsDto` côté apps/api). Une clé absente du
 * corps de requête n'efface PAS le coefficient déjà enregistré côté
 * serveur (`setCoefficients` remplace tout l'objet — voir
 * PerformanceScoreSettingsService) : le formulaire d'administration doit
 * toujours renvoyer l'objet complet, jamais un correctif partiel. */
export interface BroilerPerformanceCoefficients {
  mortality?: PerformanceScoreCoefficient;
  ic?: PerformanceScoreCoefficient;
  gmq?: PerformanceScoreCoefficient;
}

export interface LayerPerformanceCoefficients {
  mortality?: PerformanceScoreCoefficient;
  layingRate?: PerformanceScoreCoefficient;
}

export interface IncubationPerformanceCoefficients {
  hatchRate?: PerformanceScoreCoefficient;
  fertilityRate?: PerformanceScoreCoefficient;
}
