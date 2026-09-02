import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Alert } from '@dondy-elevage/shared-types';
import AnomaliesPage from './page';

const useAlertsMock = vi.fn();
const acknowledgeMutateMock = vi.fn();

vi.mock('@/features/alerts/hooks', () => ({
  useAlerts: (...args: unknown[]) => useAlertsMock(...args),
  useAcknowledgeAlert: () => ({ mutate: acknowledgeMutateMock, isPending: false }),
}));

let mockPermissions: string[] = ['alerts.acknowledge'];
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { permissions: mockPermissions } }),
}));

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    farmId: 'farm-1',
    type: 'anomalie_croisee_broiler_j10',
    severity: 'IMPORTANT',
    entityType: 'broiler_batch',
    entityId: 'batch-1',
    title: 'PC-2026-001 — Anomalie multi-signaux détectée (J8-J10)',
    message:
      'Eau : 60 L/j (récent) vs 80 L/j (référence) — -25 % (seuil 15 %)\nAliment : 40 kg/j (récent) vs 50 kg/j (référence) — -20 % (seuil 10 %)\nMortalité : 1,2 %/j (récent) vs 0,2 %/j (référence) — +500 % (seuil 50 %)\nRègle : baisse eau ET baisse aliment ET hausse mortalité simultanées.',
    status: 'TRIGGERED',
    scheduledAt: null,
    triggeredAt: '2026-09-11T06:00:00.000Z',
    acknowledgedAt: null,
    acknowledgedBy: null,
    createdAt: '2026-09-11T06:00:00.000Z',
    updatedAt: '2026-09-11T06:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions = ['alerts.acknowledge'];
});

describe('AnomaliesPage', () => {
  it('affiche la décomposition complète, jamais un résultat opaque', () => {
    useAlertsMock.mockReturnValue({ data: { items: [makeAlert()], total: 1 }, isLoading: false });
    render(<AnomaliesPage />);

    expect(screen.getByText(/Anomalie multi-signaux détectée/)).toBeInTheDocument();
    expect(screen.getByText(/Eau : 60 L\/j/)).toBeInTheDocument();
    expect(screen.getByText(/Aliment : 40 kg\/j/)).toBeInTheDocument();
    expect(screen.getByText(/Mortalité : 1,2 %\/j/)).toBeInTheDocument();
    expect(screen.getByText(/Règle : baisse eau/)).toBeInTheDocument();
  });

  it('propose l’acquittement pour une anomalie déclenchée quand la permission est présente', () => {
    useAlertsMock.mockReturnValue({ data: { items: [makeAlert()], total: 1 }, isLoading: false });
    render(<AnomaliesPage />);

    const button = screen.getByRole('button', { name: 'Acquitter' });
    fireEvent.click(button);
    expect(acknowledgeMutateMock).toHaveBeenCalledWith('alert-1');
  });

  it('masque le bouton Acquitter sans la permission ALERTS_ACKNOWLEDGE', () => {
    mockPermissions = [];
    useAlertsMock.mockReturnValue({ data: { items: [makeAlert()], total: 1 }, isLoading: false });
    render(<AnomaliesPage />);

    expect(screen.queryByRole('button', { name: 'Acquitter' })).not.toBeInTheDocument();
  });

  it('n’affiche pas le bouton Acquitter pour une anomalie déjà acquittée', () => {
    useAlertsMock.mockReturnValue({
      data: { items: [makeAlert({ status: 'ACKNOWLEDGED', acknowledgedAt: '2026-09-11T08:00:00.000Z' })], total: 1 },
      isLoading: false,
    });
    render(<AnomaliesPage />);

    expect(screen.getByText('Acquittée')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acquitter' })).not.toBeInTheDocument();
  });

  it('affiche un état vide explicite en l’absence d’anomalie', () => {
    useAlertsMock.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
    render(<AnomaliesPage />);

    expect(screen.getByText('Aucune anomalie détectée pour le moment.')).toBeInTheDocument();
  });
});
