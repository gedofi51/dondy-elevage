import { formatAnomalyDecomposition } from './anomaly-message.calculations';
import { computeDeclineSignal, computeIncreaseSignal } from './anomaly-signal.calculations';

describe('formatAnomalyDecomposition', () => {
  it('formate chaque signal avec locale fr-FR explicite, jamais un chiffre brut', () => {
    const water = computeDeclineSignal('Eau', 'L/j', [60, 60], [80, 80], 15);
    const mortality = computeIncreaseSignal('Mortalité', '%/j', [1.5, 1.5], [0.2, 0.2], 50);
    const message = formatAnomalyDecomposition(
      [water, mortality],
      'baisse eau ET hausse mortalité',
    );

    expect(message).toContain('Eau : 60 L/j (récent) vs 80 L/j (référence) — -25 % (seuil 15 %)');
    expect(message).toContain('Mortalité :');
    expect(message).toContain('+650 %');
    expect(message).toContain('Règle : baisse eau ET hausse mortalité.');
  });

  it('signal "apparition" (référence nulle) -> texte explicite, jamais "Infinity"', () => {
    const mortality = computeIncreaseSignal('Mortalité', '%/j', [0.3, 0.3], [0, 0], 50);
    const message = formatAnomalyDecomposition([mortality], 'hausse mortalité');

    expect(message).toContain('apparition (aucune référence sur la période précédente)');
    expect(message).not.toContain('Infinity');
    expect(message).not.toContain('NaN');
  });

  it('une ligne par signal, dans l’ordre fourni', () => {
    const feed = computeDeclineSignal('Aliment', 'kg/j', [40, 40], [50, 50], 10);
    const mortality = computeIncreaseSignal('Mortalité', '%/j', [1, 1], [0.5, 0.5], 50);
    const message = formatAnomalyDecomposition(
      [feed, mortality],
      'baisse aliment ET hausse mortalité',
    );
    const lines = message.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Aliment');
    expect(lines[1]).toContain('Mortalité');
    expect(lines[2]).toBe('Règle : baisse aliment ET hausse mortalité.');
  });
});
