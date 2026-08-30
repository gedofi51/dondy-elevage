/**
 * Amortissement linéaire avec prorata temporis (V6 §3.2). Modèle de
 * calendrier fiscal retenu — hypothèse documentée, voir DETTE_TECHNIQUE.md
 * Phase 16, décision C.3 : périodes alignées sur l'année civile (pas
 * l'anniversaire de mise en service), première période de `serviceDate`
 * au 31 décembre de la même année (dotation proratisée au nombre de jours
 * réels), périodes intermédiaires en années civiles pleines, DERNIÈRE
 * période = solde (base amortissable - somme des dotations précédentes)
 * pour garantir que la VNC finale tombe exactement sur la valeur
 * résiduelle sans dérive d'arrondi. Nombre total de lignes = durée + 1 si
 * `serviceDate` n'est pas un 1er janvier, `durée` lignes sinon.
 *
 * Toutes les dates sont manipulées en UTC (jamais setHours/getDate locaux)
 * — `serviceDate` provient systématiquement d'un `new Date('AAAA-MM-JJ')`
 * (toujours UTC minuit par construction du parseur JS), donc aucune
 * conversion locale ne doit intervenir ici sous peine de dérive d'un jour
 * selon le fuseau horaire d'exécution.
 */

export interface DepreciationScheduleLine {
  periodNumber: number;
  periodStart: Date;
  periodEnd: Date;
  dotationFcfa: number;
  cumulativeFcfa: number;
  netBookValueFcfa: number;
}

export function computeTotalAcquisitionCostFcfa(
  purchasePriceFcfa: number,
  installationCostFcfa: number,
): number {
  return purchasePriceFcfa + installationCostFcfa;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function endOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
}

function startOfNextYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
}

function isJanuaryFirst(date: Date): boolean {
  return date.getUTCMonth() === 0 && date.getUTCDate() === 1;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/** Convention de calcul du prorata de la première période uniquement
 * (les années pleines n'ont besoin d'aucun day-count, dotation annuelle
 * fixe) — voir DETTE_TECHNIQUE.md Phase 20. `CALENDAIRE` = comportement
 * historique (jours réels, jamais modifié). `TRENTE_360` = convention
 * 30E/360 (chaque mois compté 30 jours, année 360 jours, indépendante
 * des années bissextiles) — paramétrable via `Setting`
 * (`assets.depreciation_convention`), toujours "meilleure hypothèse
 * documentée" en attendant validation par un comptable local (voir
 * DETTE_TECHNIQUE.md Phase 16). */
export type DepreciationConvention = 'CALENDAIRE' | 'TRENTE_360';

/** 30E/360 (européenne) — jour 31 ramené à 30 pour la date de début ET
 * la date de fin, `+1` pour rester sur la même sémantique "inclusive"
 * que `daysBetweenInclusive` (une période d'un seul jour calendaire
 * compte pour 1, jamais 0). `end` vaut toujours le 31 décembre de
 * l'année de `start` dans cet usage (voir appelant) : cas limite
 * explicitement vérifié par test — `start` au 31 décembre (ramené à 30)
 * produit le minimum non nul possible (1 jour sur 360, dotation
 * arrondie proche de zéro mais jamais nulle), jamais un day-count
 * négatif ni un crash, quel que soit le jour de mise en service. */
function days360(start: Date, end: Date): number {
  const startDay = Math.min(start.getUTCDate(), 30);
  const endDay = Math.min(end.getUTCDate(), 30);
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return months * 30 + (endDay - startDay) + 1;
}

function computeProrataFraction(
  start: Date,
  end: Date,
  convention: DepreciationConvention,
): { daysInPeriod: number; daysInYear: number } {
  if (convention === 'TRENTE_360') {
    return { daysInPeriod: days360(start, end), daysInYear: 360 };
  }
  return {
    daysInPeriod: daysBetweenInclusive(start, end),
    daysInYear: isLeapYear(start.getUTCFullYear()) ? 366 : 365,
  };
}

export function computeDepreciationSchedule(
  acquisitionCostFcfa: number,
  residualValueFcfa: number,
  serviceDate: Date,
  durationYears: number,
  convention: DepreciationConvention = 'CALENDAIRE',
): DepreciationScheduleLine[] {
  if (durationYears < 1) {
    throw new Error('depreciationDurationYears doit être >= 1 (garanti par le DTO en amont).');
  }
  const baseAmortissableFcfa = acquisitionCostFcfa - residualValueFcfa;
  const fullAnnualDotationFcfa = Math.round(baseAmortissableFcfa / durationYears);

  const lines: DepreciationScheduleLine[] = [];
  let cumulative = 0;
  let periodNumber = 1;
  let periodStart = serviceDate;

  if (baseAmortissableFcfa <= 0) {
    return lines;
  }

  if (!isJanuaryFirst(serviceDate)) {
    const periodEnd = endOfYear(serviceDate);
    const { daysInPeriod, daysInYear } = computeProrataFraction(serviceDate, periodEnd, convention);
    const dotation = Math.min(
      Math.round(fullAnnualDotationFcfa * (daysInPeriod / daysInYear)),
      baseAmortissableFcfa,
    );
    cumulative += dotation;
    lines.push({
      periodNumber,
      periodStart,
      periodEnd,
      dotationFcfa: dotation,
      cumulativeFcfa: cumulative,
      netBookValueFcfa: acquisitionCostFcfa - cumulative,
    });
    periodNumber += 1;
    periodStart = startOfNextYear(periodEnd);
  }

  // Années civiles pleines jusqu'à couverture de la base — la dernière
  // ligne générée absorbe toujours le solde exact plutôt qu'une annuité
  // recalculée, qu'elle coïncide ou non avec une année civile pleine.
  while (cumulative < baseAmortissableFcfa) {
    const periodEnd = endOfYear(periodStart);
    const remaining = baseAmortissableFcfa - cumulative;
    const isLastPeriod = remaining <= fullAnnualDotationFcfa;
    const dotation = isLastPeriod ? remaining : fullAnnualDotationFcfa;
    cumulative += dotation;
    lines.push({
      periodNumber,
      periodStart,
      periodEnd,
      dotationFcfa: dotation,
      cumulativeFcfa: cumulative,
      netBookValueFcfa: acquisitionCostFcfa - cumulative,
    });
    periodNumber += 1;
    periodStart = startOfNextYear(periodEnd);
  }

  return lines;
}

/** Ligne "en vigueur" à une date donnée — la dernière dont `periodEnd` est
 * déjà passée. Utilisé pour dériver accumulatedDepreciationFcfa/
 * netBookValueFcfa à la lecture (jamais recalculé indépendamment du plan
 * déjà généré). `asOfDate` = `reformDate` si l'actif est réformé, sinon
 * aujourd'hui — plafonne l'agrégat au moment de la réforme. */
export function findCurrentDepreciationEntry<T extends { periodEnd: Date }>(
  entries: T[],
  asOfDate: Date,
): T | undefined {
  const elapsed = entries
    .filter((entry) => entry.periodEnd.getTime() <= asOfDate.getTime())
    .sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime());
  return elapsed[0];
}
