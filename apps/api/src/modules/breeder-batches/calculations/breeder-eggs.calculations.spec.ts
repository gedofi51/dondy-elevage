import { computeAvailableFertileEggs } from './breeder-eggs.calculations';

describe('computeAvailableFertileEggs', () => {
  it('soustrait le cumul déjà consommé du cumul sélectionné', () => {
    expect(computeAvailableFertileEggs(1050, 0)).toBe(1050);
    expect(computeAvailableFertileEggs(1050, 1050)).toBe(0);
  });

  it('gère un cumul partiellement consommé', () => {
    expect(computeAvailableFertileEggs(1050, 400)).toBe(650);
  });
});
