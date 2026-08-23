/** Donnée de référence en lecture seule côté frontend cette phase (select
 * de création de bande, origine=ACHAT) — pas de mutation. */
export interface Supplier {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
}
