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

export type TreasuryForecastDataStatus = 'SUFFISANT' | 'INSUFFISANT';

export interface TreasuryForecastProjection {
  revenueFcfa: number;
  totalExpensesFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
  /** Projection fin de période — négatif = besoin de trésorerie prévu. */
  netTreasuryFcfa: number;
}

/**
 * Prévisions finance (Lot 3) — GET /treasury/previsions. Période
 * implicite = mois calendaire courant (pas de query params, contrairement
 * à /journal et /summary). `realized` = TreasurySummary du 1er du mois à
 * aujourd'hui (même définition réelle que /summary, jamais dupliquée).
 * `projected` = extrapolation linéaire (règle de trois) sur le reste du
 * mois — `null` tant que dataStatus = INSUFFISANT (comparatif prévu/
 * réalisé sans persistance, voir DETTE_TECHNIQUE.md Lot 3).
 */
export interface TreasuryForecast {
  periodStart: string;
  periodEnd: string;
  daysElapsed: number;
  daysTotal: number;
  dataStatus: TreasuryForecastDataStatus;
  realized: {
    revenueFcfa: number;
    totalExpensesFcfa: number;
    netTreasuryFcfa: number;
  };
  projected: TreasuryForecastProjection | null;
  calculatedAt: string;
}
