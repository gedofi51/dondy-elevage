import { computeFeedMovementInstructions } from './feed-movement.calculations';

describe('computeFeedMovementInstructions', () => {
  it('première saisie : SORTIE intégrale (scénario §16-F, 50 kg distribués)', () => {
    expect(computeFeedMovementInstructions(null, 0, 'item-1', 50)).toEqual([
      { itemId: 'item-1', type: 'SORTIE', reason: 'DISTRIBUTION_BANDE', quantity: 50 },
    ]);
  });

  it('même article, quantité augmentée : SORTIE du delta seulement', () => {
    expect(computeFeedMovementInstructions('item-1', 50, 'item-1', 70)).toEqual([
      { itemId: 'item-1', type: 'SORTIE', reason: 'DISTRIBUTION_BANDE', quantity: 20 },
    ]);
  });

  it('même article, quantité réduite : ENTREE (RETOUR) de la réduction', () => {
    expect(computeFeedMovementInstructions('item-1', 70, 'item-1', 50)).toEqual([
      { itemId: 'item-1', type: 'ENTREE', reason: 'RETOUR', quantity: 20 },
    ]);
  });

  it('même article, quantité inchangée : aucune instruction', () => {
    expect(computeFeedMovementInstructions('item-1', 50, 'item-1', 50)).toEqual([]);
  });

  it('article changé : RETOUR intégral de l’ancien + SORTIE intégrale du nouveau (jamais un delta croisé)', () => {
    expect(computeFeedMovementInstructions('item-1', 50, 'item-2', 30)).toEqual([
      { itemId: 'item-1', type: 'ENTREE', reason: 'RETOUR', quantity: 50 },
      { itemId: 'item-2', type: 'SORTIE', reason: 'DISTRIBUTION_BANDE', quantity: 30 },
    ]);
  });

  it('article retiré (feedItemId remis à null) : RETOUR intégral, rien de plus', () => {
    expect(computeFeedMovementInstructions('item-1', 50, null, 0)).toEqual([
      { itemId: 'item-1', type: 'ENTREE', reason: 'RETOUR', quantity: 50 },
    ]);
  });

  it('aucun article jamais renseigné : aucune instruction', () => {
    expect(computeFeedMovementInstructions(null, 0, null, 0)).toEqual([]);
  });
});
