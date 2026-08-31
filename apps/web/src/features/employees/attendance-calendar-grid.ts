/**
 * Grille de mois pour AttendanceCalendar — pure, testée isolément (même
 * discipline que day-number.ts, features/broiler-batches). Aucun composant
 * de calendrier réutilisable trouvé ailleurs dans le repo (recherche Lot
 * 6b) ni dépendance calendrier existante (react-day-picker, date-fns…) —
 * grille construite à la main avec l'API `Date` native plutôt que
 * d'introduire une nouvelle dépendance pour un simple mois 6 semaines ×
 * 7 jours.
 */

export const weekdayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

/** Jours ISO (YYYY-MM-DD) du mois `monthIndex` (0 = janvier) de `year`,
 * alignés sur une grille de 6 semaines (42 cases) commençant le lundi —
 * `null` pour les cases hors mois (avant le 1er ou après le dernier jour),
 * jamais un jour d'un mois voisin affiché à tort comme faisant partie du
 * mois courant. Calculs en UTC pour éviter tout décalage de fuseau horaire
 * entre la construction de la grille et les dates ISO déjà stockées par
 * l'API (Attendance.date, sérialisée en UTC).
 */
export function buildMonthGrid(year: number, monthIndex: number): (string | null)[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  // getUTCDay() : 0 = dimanche..6 = samedi — décalage pour un alignement lundi.
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
