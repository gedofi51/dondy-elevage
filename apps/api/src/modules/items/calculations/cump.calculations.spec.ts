import { computeWeightedAverageCost } from './cump.calculations';

describe('computeWeightedAverageCost', () => {
  it('calcule le CUMP du scénario §16-F (500 kg à 400 FCFA/kg, stock initial vide)', () => {
    expect(computeWeightedAverageCost(0, 0, 500, 400)).toBe(400);
  });

  it('pondère un nouvel achat avec le stock existant', () => {
    // 100 kg à 400 FCFA (40 000) + 100 kg à 600 FCFA (60 000) = 200 kg, 100 000 FCFA -> 500 FCFA/kg.
    expect(computeWeightedAverageCost(100, 400, 100, 600)).toBe(500);
  });

  it('arrondit à l’entier le plus proche (FCFA, pas de centimes)', () => {
    // 3 kg à 100 FCFA (300) + 1 kg à 100 FCFA (100) = 4 kg, 400 FCFA -> 100 FCFA/kg, pas d’arrondi ici.
    // Cas avec arrondi réel : 1 kg à 100 + 1 kg à 101 = 2 kg, 201 FCFA -> 100.5 -> 101 (arrondi standard).
    expect(computeWeightedAverageCost(1, 100, 1, 101)).toBe(101);
  });

  it('retourne le coût saisi quand aucune quantité totale positive (garde-fou division par zéro)', () => {
    expect(computeWeightedAverageCost(0, 0, 0, 400)).toBe(400);
  });
});
