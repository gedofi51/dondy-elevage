export type TreasuryJournalEntryType = 'ENCAISSEMENT' | 'DECAISSEMENT';
export type TreasuryJournalEntrySource = 'payment' | 'supplier_payment' | 'expense';

export interface TreasuryJournalEntry {
  date: string;
  type: TreasuryJournalEntryType;
  source: TreasuryJournalEntrySource;
  amountFcfa: number;
  method: string | null;
  reference: string | null;
  description: string | null;
}

export interface TreasuryJournal {
  periodStart: string;
  periodEnd: string;
  entries: TreasuryJournalEntry[];
  totalEncaissementsFcfa: number;
  totalDecaissementsFcfa: number;
  netFcfa: number;
}

/** Snapshot global, sans notion de période — ventes confirmées à un
 * client identifié non intégralement payées (vente comptoir exclue par
 * construction, customerId null). */
export interface ReceivableByCustomer {
  customerId: string;
  customerName: string;
  totalSoldFcfa: number;
  totalPaidFcfa: number;
  balanceFcfa: number;
}

/** Snapshot global, sans notion de période — commandes non annulées non
 * intégralement payées. */
export interface PayableBySupplier {
  supplierId: string;
  supplierName: string;
  totalOrderedFcfa: number;
  totalPaidFcfa: number;
  balanceFcfa: number;
}

/** netTreasuryFcfa = encaissements - décaissements SUR LA PÉRIODE, pas un
 * solde cumulé depuis l'origine de la ferme. */
export interface TreasurySummary {
  periodStart: string;
  periodEnd: string;
  revenueFcfa: number;
  totalExpensesFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
  netTreasuryFcfa: number;
}
