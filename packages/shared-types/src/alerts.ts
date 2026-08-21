export type AlertSeverity = 'INFO' | 'VIGILANCE' | 'IMPORTANT' | 'CRITIQUE';
export type AlertStatus = 'CREATED' | 'TRIGGERED' | 'ACKNOWLEDGED';

export interface Alert {
  id: string;
  farmId: string;
  type: string;
  severity: AlertSeverity;
  entityType: string | null;
  entityId: string | null;
  title: string;
  message: string | null;
  status: AlertStatus;
  scheduledAt: string | null;
  triggeredAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
