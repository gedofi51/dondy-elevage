import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Alert } from '@dondy-elevage/shared-types';
import { DashboardAlertsPanel } from './dashboard-alerts-panel';

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    farmId: 'farm-1',
    type: 'batch_high_mortality_j18',
    severity: 'CRITIQUE',
    entityType: 'broiler_batch',
    entityId: 'b1',
    title: 'Mortalité élevée — Bande A-15',
    message: '3,6% aujourd’hui · inspection requise',
    status: 'TRIGGERED',
    acknowledgedAt: null,
    scheduledAt: null,
    triggeredAt: null,
    acknowledgedBy: null,
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('DashboardAlertsPanel', () => {
  it('affiche un état rassurant explicite sans alerte active', () => {
    render(<DashboardAlertsPanel alerts={[]} />);
    expect(screen.getByText('Aucune alerte active.')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('affiche le badge avec le nombre réel d’alertes actives', () => {
    render(<DashboardAlertsPanel alerts={[makeAlert(), makeAlert({ id: 'alert-2' })]} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('affiche le titre et le premier message de chaque alerte', () => {
    render(<DashboardAlertsPanel alerts={[makeAlert()]} />);
    expect(screen.getByText('Mortalité élevée — Bande A-15')).toBeInTheDocument();
    expect(screen.getByText('3,6% aujourd’hui · inspection requise')).toBeInTheDocument();
  });

  it('porte l’ancre #alertes ciblée par la cloche de l’en-tête', () => {
    const { container } = render(<DashboardAlertsPanel alerts={[]} />);
    expect(container.querySelector('#alertes')).toBeInTheDocument();
  });
});
