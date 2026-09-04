import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { DashboardInfrastructurePanel } from './dashboard-infrastructure-panel';

let mockPermissions: string[] = [
  PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_READ,
  PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_READ,
  PERMISSIONS.NETWORK_STATUS_READINGS_READ,
];
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { permissions: mockPermissions } }),
}));

const useInfrastructureStatusSummaryMock = vi.fn();
vi.mock('@/features/infrastructure/hooks', () => ({
  useInfrastructureStatusSummary: () => useInfrastructureStatusSummaryMock(),
}));

const waterAsset = { id: 'a1', category: 'eau', status: 'ACTIF' } as never;
const solarAsset = { id: 'a2', category: 'solaire', status: 'ACTIF' } as never;
const networkAsset = { id: 'a3', category: 'internet', status: 'ACTIF' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions = [
    PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_READ,
    PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_READ,
    PERMISSIONS.NETWORK_STATUS_READINGS_READ,
  ];
});

describe('DashboardInfrastructurePanel', () => {
  it('affiche les 3 lignes avec leurs valeurs réelles', () => {
    useInfrastructureStatusSummaryMock.mockReturnValue({
      water: { asset: waterAsset, latestReading: { reservoirLevelPercent: '78' } },
      solar: { asset: solarAsset, latestReading: { batteryChargePercent: '64' } },
      network: { asset: networkAsset, latestReading: { operationalStatus: 'OPERATIONNEL' } },
      isLoading: false,
    });
    render(<DashboardInfrastructurePanel assets={[]} />);
    expect(screen.getByText('78 %')).toBeInTheDocument();
    expect(screen.getByText('64 %')).toBeInTheDocument();
    expect(screen.getByText('Connecté')).toBeInTheDocument();
  });

  it('ligne sans relevé récent : "—", jamais un pourcentage inventé', () => {
    useInfrastructureStatusSummaryMock.mockReturnValue({
      water: { asset: waterAsset, latestReading: undefined },
      solar: undefined,
      network: undefined,
      isLoading: false,
    });
    render(<DashboardInfrastructurePanel assets={[]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('ne rend rien si aucun asset infrastructure n’existe sur la ferme', () => {
    useInfrastructureStatusSummaryMock.mockReturnValue({
      water: undefined,
      solar: undefined,
      network: undefined,
      isLoading: false,
    });
    const { container } = render(<DashboardInfrastructurePanel assets={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('un rôle sans WATER_INFRASTRUCTURE_READINGS_READ ne voit pas la ligne Eau (RBAC par ligne)', () => {
    mockPermissions = [PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_READ];
    useInfrastructureStatusSummaryMock.mockReturnValue({
      water: { asset: waterAsset, latestReading: { reservoirLevelPercent: '78' } },
      solar: { asset: solarAsset, latestReading: { batteryChargePercent: '64' } },
      network: undefined,
      isLoading: false,
    });
    render(<DashboardInfrastructurePanel assets={[]} />);
    expect(screen.queryByText('Eau · Forage + réserve')).not.toBeInTheDocument();
    expect(screen.getByText('Énergie · Solaire + batteries')).toBeInTheDocument();
  });
});
