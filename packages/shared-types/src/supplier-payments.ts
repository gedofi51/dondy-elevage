/** Append-only (pas de PATCH) — correction = suppression (soft) +
 * recréation. Entité séparée de `Payment` (paiement client), pas une
 * généralisation. */
export interface SupplierPayment {
  id: string;
  farmId: string;
  purchaseOrderId: string;
  date: string;
  method: string;
  amountFcfa: number;
  reference: string | null;
  observation: string | null;
  createdAt: string;
  createdBy: string | null;
}

/** Contrôle de plafond (§15) implémenté côté service — 409 exact
 * `` `Paiement (${amountFcfa} FCFA) supérieur au solde restant
 * (${balance} FCFA).` `` si dépassement, extractMessage suffit à le
 * remonter tel quel. */
export interface CreateSupplierPaymentInput {
  purchaseOrderId: string;
  date: string;
  method: string;
  amountFcfa: number;
  reference?: string;
  observation?: string;
}
