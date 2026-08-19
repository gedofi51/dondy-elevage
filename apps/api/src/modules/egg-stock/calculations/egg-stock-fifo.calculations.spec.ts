import { computeFifoAllocation, type EggStockLotForFifo } from './egg-stock-fifo.calculations';

const lot1: EggStockLotForFifo = { id: 'lot1', productionDate: new Date('2026-08-01'), remaining: 920 };
const lot2: EggStockLotForFifo = { id: 'lot2', productionDate: new Date('2026-08-02'), remaining: 910 };
const lot3: EggStockLotForFifo = { id: 'lot3', productionDate: new Date('2026-08-03'), remaining: 910 };

describe('computeFifoAllocation', () => {
  it('consomme un seul lot quand il suffit', () => {
    const allocation = computeFifoAllocation([lot1, lot2, lot3], 300);
    expect(allocation).toEqual([{ lotId: 'lot1', quantity: 300 }]);
  });

  it('épuise le lot le plus ancien avant de puiser dans le suivant (scénario §16-B, vente de 1500)', () => {
    const allocation = computeFifoAllocation([lot1, lot2, lot3], 1500);
    expect(allocation).toEqual([
      { lotId: 'lot1', quantity: 920 },
      { lotId: 'lot2', quantity: 580 },
    ]);
  });

  it('ne retouche jamais un lot déjà épuisé ni ne saute un lot actif plus ancien', () => {
    const exhaustedLot1: EggStockLotForFifo = { ...lot1, remaining: 0 };
    const allocation = computeFifoAllocation([exhaustedLot1, lot2, lot3], 300);
    expect(allocation).toEqual([{ lotId: 'lot2', quantity: 300 }]);
  });

  it('respecte l’ordre par date même si les lots sont passés dans le désordre', () => {
    const allocation = computeFifoAllocation([lot3, lot1, lot2], 920);
    expect(allocation).toEqual([{ lotId: 'lot1', quantity: 920 }]);
  });

  it('retourne null si la quantité demandée dépasse le stock total disponible (§15)', () => {
    const allocation = computeFifoAllocation([lot1, lot2, lot3], 1000 * 1000);
    expect(allocation).toBeNull();
  });

  it('retourne null pour une quantité nulle ou négative', () => {
    expect(computeFifoAllocation([lot1], 0)).toBeNull();
    expect(computeFifoAllocation([lot1], -5)).toBeNull();
  });

  it('consomme exactement tout le stock disponible sans reliquat', () => {
    const allocation = computeFifoAllocation([lot1, lot2], 1830);
    expect(allocation).toEqual([
      { lotId: 'lot1', quantity: 920 },
      { lotId: 'lot2', quantity: 910 },
    ]);
  });
});
