/** Donnée de référence en lecture seule côté frontend cette phase (select
 * de création de bande) — pas de mutation, pas de champ non utilisé par
 * un select. */
export interface Building {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
}
