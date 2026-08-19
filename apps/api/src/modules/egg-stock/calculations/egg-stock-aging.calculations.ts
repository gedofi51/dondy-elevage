const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** §5.5 : "Stock d'œufs vieillissant" — âge en jours pleins depuis la
 * production du lot. */
export function computeLotAgeDays(productionDate: Date, today: Date): number {
  return Math.floor((today.getTime() - productionDate.getTime()) / MS_PER_DAY);
}

export type EggStockAgingSeverity = 'NONE' | 'VIGILANCE' | 'IMPORTANT';

/** Seuils sourcés (Healthline / American Egg Board, voir Setting
 * layer.egg_stock_aging_*_days) — défauts 4j/7j, ajustés à la baisse pour un
 * climat équatorial sans chaîne du froid garantie (Samba). */
export function resolveAgingSeverity(
  ageDays: number,
  vigilanceThresholdDays: number,
  importantThresholdDays: number,
): EggStockAgingSeverity {
  if (ageDays >= importantThresholdDays) {
    return 'IMPORTANT';
  }
  if (ageDays >= vigilanceThresholdDays) {
    return 'VIGILANCE';
  }
  return 'NONE';
}
