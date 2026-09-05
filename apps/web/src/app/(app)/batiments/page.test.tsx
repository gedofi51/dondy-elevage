import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Building } from '@dondy-elevage/shared-types';
import BuildingsListPage from './page';

const useBuildingsMock = vi.fn();
const deleteMutateAsync = vi.fn();
vi.mock('@/features/buildings/hooks', () => ({
  useBuildings: () => useBuildingsMock(),
  useDeleteBuilding: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}));

let mockPermissions: string[] = ['buildings.create', 'buildings.update', 'buildings.delete'];
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { permissions: mockPermissions } }),
}));

function makeBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: 'building-1',
    farmId: 'farm-1',
    name: 'Poulailler A',
    type: 'poulailler',
    capacity: 500,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions = ['buildings.create', 'buildings.update', 'buildings.delete'];
});

describe('BuildingsListPage', () => {
  it('affiche les bâtiments avec nom (lien), type et capacité', () => {
    useBuildingsMock.mockReturnValue({ data: [makeBuilding()], isLoading: false });
    render(<BuildingsListPage />);

    const link = screen.getByRole('link', { name: 'Poulailler A' });
    expect(link).toHaveAttribute('href', '/batiments/building-1');
    expect(screen.getByText('Poulailler')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('propose Nouveau bâtiment et les actions Modifier/Supprimer quand les permissions le permettent', () => {
    useBuildingsMock.mockReturnValue({ data: [makeBuilding()], isLoading: false });
    render(<BuildingsListPage />);

    expect(screen.getByRole('button', { name: /Nouveau bâtiment/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '' }).length).toBeGreaterThan(0); // icônes Modifier/Supprimer
  });

  it('masque création/édition/suppression sans les permissions BUILDINGS_*', () => {
    mockPermissions = [];
    useBuildingsMock.mockReturnValue({ data: [makeBuilding()], isLoading: false });
    render(<BuildingsListPage />);

    expect(screen.queryByRole('button', { name: /Nouveau bâtiment/ })).not.toBeInTheDocument();
  });

  it('affiche un état vide explicite en l’absence de bâtiment', () => {
    useBuildingsMock.mockReturnValue({ data: [], isLoading: false });
    render(<BuildingsListPage />);
    expect(screen.getByText('Aucun bâtiment pour le moment.')).toBeInTheDocument();
  });
});
