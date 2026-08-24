import type { StockMovementReason, StockMovementType } from '@dondy-elevage/shared-types';

/** Mapping fixe reason→type pour tous les motifs manuels sauf AJUSTEMENT
 * (qui peut être une entrée ou une sortie selon l'écart d'inventaire —
 * l'utilisateur doit alors choisir explicitement). Réplique le
 * commentaire schema.prisma StockMovementReason, jamais exposé par
 * l'API : le DTO exige `type` dans tous les cas, ce mapping sert à le
 * pré-remplir/masquer côté formulaire. */
export function getStockMovementTypeForReason(
  reason: StockMovementReason,
): StockMovementType | 'CHOICE' {
  switch (reason) {
    case 'RETOUR':
    case 'PRODUCTION_INTERNE':
      return 'ENTREE';
    case 'VENTE':
    case 'PERTE':
    case 'CASSE':
    case 'CONSOMMATION_INTERNE':
      return 'SORTIE';
    case 'AJUSTEMENT':
      return 'CHOICE';
    case 'ACHAT':
    case 'DISTRIBUTION_BANDE':
      // Réservés au flux automatique, jamais atteignables en saisie
      // manuelle (rejetés 400 côté serveur) — ENTREE/SORTIE réel indiqué
      // pour complétude, mais ces valeurs ne doivent jamais être
      // proposées dans MANUAL_STOCK_MOVEMENT_REASONS.
      return reason === 'ACHAT' ? 'ENTREE' : 'SORTIE';
  }
}
