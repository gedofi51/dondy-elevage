import type { AlertSeverity } from '@dondy-elevage/shared-types';
import { StatusBadge } from './status-badge';

const severityLabels: Record<AlertSeverity, string> = {
  INFO: 'Info',
  VIGILANCE: 'Vigilance',
  IMPORTANT: 'Important',
  CRITIQUE: 'Critique',
};

const severityTones: Record<AlertSeverity, 'info' | 'warning' | 'destructive'> = {
  INFO: 'info',
  VIGILANCE: 'warning',
  IMPORTANT: 'warning',
  CRITIQUE: 'destructive',
};

export function AlertBadge({ severity }: { severity: AlertSeverity }) {
  return <StatusBadge label={severityLabels[severity]} tone={severityTones[severity]} />;
}
