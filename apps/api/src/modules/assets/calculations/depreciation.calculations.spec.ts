import {
  computeDepreciationSchedule,
  computeTotalAcquisitionCostFcfa,
  findCurrentDepreciationEntry,
} from './depreciation.calculations';

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

describe('computeTotalAcquisitionCostFcfa', () => {
  it('additionne le prix d’achat et les frais d’installation', () => {
    expect(computeTotalAcquisitionCostFcfa(500_000, 50_000)).toBe(550_000);
  });

  it('gère des frais d’installation nuls', () => {
    expect(computeTotalAcquisitionCostFcfa(500_000, 0)).toBe(500_000);
  });
});

describe('computeDepreciationSchedule', () => {
  it('génère exactement `durée` lignes quand serviceDate est un 1er janvier (pas de prorata)', () => {
    const lines = computeDepreciationSchedule(500_000, 0, utc(2026, 1, 1), 5);
    expect(lines).toHaveLength(5);
    expect(lines.map((l) => l.dotationFcfa)).toEqual([100_000, 100_000, 100_000, 100_000, 100_000]);
    const first = lines[0]!;
    const last = lines[4]!;
    expect(first.periodStart).toEqual(utc(2026, 1, 1));
    expect(first.periodEnd).toEqual(utc(2026, 12, 31));
    expect(last.periodEnd).toEqual(utc(2030, 12, 31));
    expect(last.cumulativeFcfa).toBe(500_000);
    expect(last.netBookValueFcfa).toBe(0);
  });

  it('proratise la première période et ajoute une ligne solde quand serviceDate n’est pas le 1er janvier (durée + 1 lignes)', () => {
    // 2026 n'est pas bissextile (365 jours) — 1er juillet à 31 décembre = 184 jours.
    const lines = computeDepreciationSchedule(100_000, 0, utc(2026, 7, 1), 1);
    expect(lines).toHaveLength(2);
    const first = lines[0]!;
    const second = lines[1]!;

    expect(first.periodNumber).toBe(1);
    expect(first.periodStart).toEqual(utc(2026, 7, 1));
    expect(first.periodEnd).toEqual(utc(2026, 12, 31));
    expect(first.dotationFcfa).toBe(50_411); // round(100000 * 184/365)
    expect(first.cumulativeFcfa).toBe(50_411);

    expect(second.periodNumber).toBe(2);
    expect(second.periodStart).toEqual(utc(2027, 1, 1));
    expect(second.periodEnd).toEqual(utc(2027, 12, 31));
    expect(second.dotationFcfa).toBe(49_589); // solde, pas une annuité recalculée
    expect(second.cumulativeFcfa).toBe(100_000);
    expect(second.netBookValueFcfa).toBe(0);
  });

  it('tient compte d’une valeur résiduelle non nulle (VNC finale = valeur résiduelle, pas 0)', () => {
    const lines = computeDepreciationSchedule(500_000, 50_000, utc(2026, 1, 1), 5);
    const base = 500_000 - 50_000;
    const total = lines.reduce((sum, l) => sum + l.dotationFcfa, 0);
    expect(total).toBe(base);
    expect(lines[lines.length - 1]!.netBookValueFcfa).toBe(50_000);
  });

  it('couvre une année bissextile dans le calcul du prorata (366 jours, pas 365)', () => {
    // 2028 est bissextile — 1er mars à 31 décembre = 306 jours (2028 a 366 jours).
    const lines = computeDepreciationSchedule(366_000, 0, utc(2028, 3, 1), 3);
    const daysInPeriod = 306;
    const fullAnnual = Math.round(366_000 / 3);
    const expectedFirstDotation = Math.round(fullAnnual * (daysInPeriod / 366));
    expect(lines[0]!.dotationFcfa).toBe(expectedFirstDotation);
  });

  it('la somme des dotations tombe toujours exactement sur la base amortissable, sans dérive d’arrondi', () => {
    // Cas volontairement peu divisible pour exercer l'arrondi.
    const lines = computeDepreciationSchedule(333_333, 11_111, utc(2026, 4, 17), 7);
    const base = 333_333 - 11_111;
    const total = lines.reduce((sum, l) => sum + l.dotationFcfa, 0);
    expect(total).toBe(base);
    expect(lines[lines.length - 1]!.cumulativeFcfa).toBe(base);
  });

  it('gère une durée de 1 an avec mise en service au 1er janvier (une seule ligne)', () => {
    const lines = computeDepreciationSchedule(100_000, 0, utc(2026, 1, 1), 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.dotationFcfa).toBe(100_000);
    expect(lines[0]!.periodEnd).toEqual(utc(2026, 12, 31));
  });

  it('retourne un plan vide si la base amortissable est nulle ou négative (résiduelle >= coût)', () => {
    expect(computeDepreciationSchedule(100_000, 100_000, utc(2026, 1, 1), 5)).toEqual([]);
    expect(computeDepreciationSchedule(100_000, 150_000, utc(2026, 1, 1), 5)).toEqual([]);
  });

  it('rejette une durée invalide (< 1 an)', () => {
    expect(() => computeDepreciationSchedule(100_000, 0, utc(2026, 1, 1), 0)).toThrow();
  });
});

describe('computeDepreciationSchedule — convention TRENTE_360 (Phase 20)', () => {
  it('mise en service alignée sur un début de mois (1er avril, durée 1 an)', () => {
    // Avril à décembre = 9 mois pleins - 1 jour de départ + 1 (inclusif) = 270/360.
    const lines = computeDepreciationSchedule(360_000, 0, utc(2026, 4, 1), 1, 'TRENTE_360');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.dotationFcfa).toBe(270_000); // round(360000 * 270/360)
    expect(lines[1]!.dotationFcfa).toBe(90_000); // solde
    expect(lines[1]!.cumulativeFcfa).toBe(360_000);
  });

  it('milieu de mois (15 mars, durée 1 an)', () => {
    const lines = computeDepreciationSchedule(360_000, 0, utc(2026, 3, 15), 1, 'TRENTE_360');
    expect(lines[0]!.dotationFcfa).toBe(286_000); // round(360000 * 286/360)
    expect(lines[1]!.dotationFcfa).toBe(74_000); // solde
    expect(lines[1]!.cumulativeFcfa).toBe(360_000);
  });

  it('fin de mois — le 31 (31 janvier, durée 1 an)', () => {
    const lines = computeDepreciationSchedule(360_000, 0, utc(2026, 1, 31), 1, 'TRENTE_360');
    expect(lines[0]!.dotationFcfa).toBe(331_000); // round(360000 * 331/360)
    expect(lines[1]!.dotationFcfa).toBe(29_000); // solde
  });

  it('cas limite — mise en service le 31 décembre : dotation minimale non nulle, jamais 0', () => {
    // Jour 31 ramené à 30 pour début ET fin (30E/360) — écart de 1 jour
    // (sémantique inclusive), pas 0 : voir commentaire de days360().
    const lines = computeDepreciationSchedule(360_000, 0, utc(2026, 12, 31), 1, 'TRENTE_360');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.dotationFcfa).toBe(1_000); // round(360000 * 1/360)
    expect(lines[0]!.dotationFcfa).toBeGreaterThan(0);
    expect(lines[1]!.dotationFcfa).toBe(359_000); // solde
    expect(lines[1]!.cumulativeFcfa).toBe(360_000);
  });

  it('1er janvier : prorata sautée quelle que soit la convention (identique à CALENDAIRE)', () => {
    const trente360 = computeDepreciationSchedule(100_000, 0, utc(2026, 1, 1), 1, 'TRENTE_360');
    const calendaire = computeDepreciationSchedule(100_000, 0, utc(2026, 1, 1), 1, 'CALENDAIRE');
    expect(trente360).toEqual(calendaire);
    expect(trente360).toHaveLength(1);
    expect(trente360[0]!.dotationFcfa).toBe(100_000);
  });

  it('indépendante des années bissextiles — même dotation pour une mise en service au même jour, année bissextile ou non', () => {
    const leap = computeDepreciationSchedule(360_000, 0, utc(2028, 3, 1), 1, 'TRENTE_360');
    const nonLeap = computeDepreciationSchedule(360_000, 0, utc(2029, 3, 1), 1, 'TRENTE_360');
    expect(leap[0]!.dotationFcfa).toBe(nonLeap[0]!.dotationFcfa);
  });

  it('la somme des dotations tombe toujours exactement sur la base amortissable (cas peu divisible)', () => {
    const lines = computeDepreciationSchedule(333_333, 11_111, utc(2026, 4, 17), 7, 'TRENTE_360');
    const base = 333_333 - 11_111;
    const total = lines.reduce((sum, l) => sum + l.dotationFcfa, 0);
    expect(total).toBe(base);
    expect(lines[lines.length - 1]!.cumulativeFcfa).toBe(base);
  });
});

describe('findCurrentDepreciationEntry', () => {
  const entries = [
    { periodEnd: utc(2026, 12, 31), label: 'year1' },
    { periodEnd: utc(2027, 12, 31), label: 'year2' },
    { periodEnd: utc(2028, 12, 31), label: 'year3' },
  ];

  it('retourne la dernière période déjà écoulée à la date donnée', () => {
    expect(findCurrentDepreciationEntry(entries, utc(2027, 6, 1))?.label).toBe('year1');
    expect(findCurrentDepreciationEntry(entries, utc(2027, 12, 31))?.label).toBe('year2');
  });

  it('retourne undefined si aucune période n’est encore écoulée', () => {
    expect(findCurrentDepreciationEntry(entries, utc(2026, 1, 1))).toBeUndefined();
  });

  it('retourne la dernière période si toutes sont déjà écoulées (actif totalement amorti)', () => {
    expect(findCurrentDepreciationEntry(entries, utc(2030, 1, 1))?.label).toBe('year3');
  });
});
