// Miroir de apps/api/src/common/pagination/paginated-result.interface.ts —
// enveloppe limit/offset. Seuls Alerts et Notifications l'utilisent
// aujourd'hui (voir commentaire du fichier source) ; les autres listes
// (WaterPoint, PurchaseOrder, bandes...) renvoient un tableau simple.
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
