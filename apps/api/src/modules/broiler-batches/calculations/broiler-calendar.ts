import type { AlertSeverity } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * §3.1 : "J1 correspond à la date d'arrivée." Comparaison sur la date
 * calendaire seule (heure ignorée) pour éviter un décalage d'un jour selon
 * l'heure de saisie.
 */
export function computeDayNumber(arrivalDate: Date, today: Date): number {
  const diffDays = Math.floor(
    (startOfDay(today).getTime() - startOfDay(arrivalDate).getTime()) / MS_PER_DAY,
  );
  return diffDays + 1;
}

export interface CalendarMilestone {
  /** Identifiant stable pour la vérification d'idempotence du cron (voir AlertsService.createSystemAlert). */
  type: string;
  title: string;
  severity: AlertSeverity;
}

/**
 * §9 : jalons calendaires J1-J45 (toujours calculés depuis arrivalDate,
 * jamais depuis plannedSaleDate — notions indépendantes). Sévérité : jalons
 * de phase -> INFO, échéances commerciales J40-J45 -> IMPORTANT, dépassement
 * J46+ -> CRITIQUE.
 */
const MILESTONES: Record<number, Omit<CalendarMilestone, 'type'>> = {
  1: { title: 'Bande entrée en élevage aujourd’hui', severity: 'INFO' },
  7: { title: 'Contrôle de première semaine', severity: 'INFO' },
  14: { title: 'Fin de la phase de démarrage', severity: 'INFO' },
  15: { title: 'Passage en phase croissance', severity: 'INFO' },
  21: { title: 'Contrôle de croissance recommandé', severity: 'INFO' },
  30: { title: 'Fin de la phase croissance', severity: 'INFO' },
  31: { title: 'Passage en finition', severity: 'INFO' },
  35: { title: 'Vérifier stock aliment finition et poids moyen', severity: 'INFO' },
  40: { title: 'Préparation commerciale — vente prévue dans 5 jours', severity: 'IMPORTANT' },
  42: { title: 'Vente prévue dans 3 jours', severity: 'IMPORTANT' },
  44: { title: 'Vente prévue demain', severity: 'IMPORTANT' },
  45: { title: 'Âge commercial cible atteint', severity: 'IMPORTANT' },
};

/** J46+ : une seule alerte (idempotente via son type fixe), pas une par jour de dépassement. */
const OVERDUE_MILESTONE: CalendarMilestone = {
  type: 'batch_calendar_j46_plus',
  title: 'Bande ayant dépassé l’âge commercial prévu',
  severity: 'CRITIQUE',
};

export function resolveCalendarMilestone(dayNumber: number): CalendarMilestone | null {
  if (dayNumber >= 46) {
    return OVERDUE_MILESTONE;
  }
  const milestone = MILESTONES[dayNumber];
  return milestone ? { type: `batch_calendar_j${dayNumber}`, ...milestone } : null;
}
