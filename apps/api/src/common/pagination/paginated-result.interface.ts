/** Enveloppe de pagination limit/offset — voir Alerts et Notifications, seuls
 * endpoints paginés de ce backend (données qui s'accumulent avec l'usage,
 * contrairement aux données de référence). */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
