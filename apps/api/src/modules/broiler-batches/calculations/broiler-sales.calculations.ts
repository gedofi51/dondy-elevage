import type { SaleStatus } from '@prisma/client';

/** §10.3 : "Montant brut = quantité × prix unitaire." */
export function computeGrossAmountFcfa(quantity: number, unitPriceFcfa: number): number {
  return quantity * unitPriceFcfa;
}

/** §10.3 : "Montant net = montant brut - remise." */
export function computeNetAmountFcfa(grossAmountFcfa: number, discountFcfa: number): number {
  return grossAmountFcfa - discountFcfa;
}

const NON_PAYABLE_STATUSES: SaleStatus[] = ['BROUILLON', 'RESERVEE', 'ANNULEE'];

/**
 * Recalcule le statut de vente après enregistrement d'un paiement — §10.4 :
 * brouillon, réservée, confirmée, payée, partiellement payée, impayée,
 * annulée. Un statut brouillon/réservé/annulé n'est jamais modifié par un
 * paiement (ces statuts précèdent ou excluent le paiement). Un
 * `cumulativePaidFcfa` supérieur à `netAmountFcfa` (trop-perçu) reste
 * "payée" — cette fonction ne plafonne jamais silencieusement le montant,
 * c'est au service appelant de signaler l'anomalie si besoin.
 */
export function computeSaleStatus(
  netAmountFcfa: number,
  cumulativePaidFcfa: number,
  currentStatus: SaleStatus,
): SaleStatus {
  if (NON_PAYABLE_STATUSES.includes(currentStatus)) {
    return currentStatus;
  }
  if (cumulativePaidFcfa <= 0) {
    return 'IMPAYEE';
  }
  if (cumulativePaidFcfa >= netAmountFcfa) {
    return 'PAYEE';
  }
  return 'PARTIELLEMENT_PAYEE';
}
