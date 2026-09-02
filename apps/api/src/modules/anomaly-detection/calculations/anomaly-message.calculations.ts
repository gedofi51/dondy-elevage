import type { AnomalySignal } from './anomaly-signal.calculations';

/**
 * Détection d'anomalies (Lot 4) — construit le texte de décomposition
 * stocké dans `Alert.message` (`@db.Text`, pas de migration nécessaire —
 * voir DETTE_TECHNIQUE.md). Une ligne par signal + une ligne de règle,
 * jamais un JSON opaque : lisible nativement, même convention que les
 * titres d'alerte existants qui embarquent déjà leurs valeurs calculées
 * (voir BroilerAlertsCronService.checkPreviousDayIssues). Locale FR
 * explicite sur chaque nombre (leçon des Lots 2/3 : jamais de
 * `toLocaleString()` sans argument).
 */
function formatSignalLine(signal: AnomalySignal): string {
  const recent = signal.recentAverage.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const baseline = signal.baselineAverage.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const changeText = Number.isFinite(signal.changePercent)
    ? `${signal.changePercent >= 0 ? '+' : ''}${signal.changePercent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
    : 'apparition (aucune référence sur la période précédente)';
  return `${signal.label} : ${recent} ${signal.unit} (récent) vs ${baseline} ${signal.unit} (référence) — ${changeText} (seuil ${signal.thresholdPercent} %)`;
}

/**
 * `signals` : uniquement les signaux évalués (jamais `null` — un signal
 * absent, faute de mesure, n'a rien à décomposer). `ruleDescription`
 * précise la combinaison exacte qui a déclenché (différente entre
 * Broiler à 3 signaux et Layer à 2, voir les crons respectifs).
 */
export function formatAnomalyDecomposition(
  signals: AnomalySignal[],
  ruleDescription: string,
): string {
  const lines = signals.map(formatSignalLine);
  lines.push(`Règle : ${ruleDescription}.`);
  return lines.join('\n');
}
