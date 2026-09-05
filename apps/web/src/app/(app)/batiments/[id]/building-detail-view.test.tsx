import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Block, Building } from '@dondy-elevage/shared-types';
import { BuildingDetailView } from './building-detail-view';

const useBuildingMock = vi.fn();
vi.mock('@/features/buildings/hooks', () => ({
  useBuilding: (id: string) => useBuildingMock(id),
}));

const useBlocksMock = vi.fn();
const deleteBlockMutateAsync = vi.fn();
vi.mock('@/features/blocks/hooks', () => ({
  useBlocks: () => useBlocksMock(),
  useDeleteBlock: () => ({ mutateAsync: deleteBlockMutateAsync, isPending: false }),
}));

vi.mock('@/features/blocks/components/block-create-dialog', () => ({
  BlockCreateDialog: () => null,
}));
vi.mock('@/features/blocks/components/block-edit-dialog', () => ({
  BlockEditDialog: () => null,
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

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    farmId: 'farm-1',
    buildingId: 'building-1',
    name: 'Bloc Nord',
    code: 'N1',
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

describe('BuildingDetailView', () => {
  it('affiche les informations du bâtiment et ses blocs, filtrés par buildingId', () => {
    useBuildingMock.mockReturnValue({ data: makeBuilding(), isLoading: false });
    useBlocksMock.mockReturnValue({
      data: [makeBlock(), makeBlock({ id: 'block-2', buildingId: 'building-2', name: 'Bloc autre bâtiment' })],
      isLoading: false,
    });

    render(<BuildingDetailView buildingId="building-1" />);

    expect(screen.getByText('Poulailler A')).toBeInTheDocument();
    expect(screen.getByText('Bloc Nord')).toBeInTheDocument();
    expect(screen.queryByText('Bloc autre bâtiment')).not.toBeInTheDocument();
  });

  it('affiche un état vide explicite en l’absence de bloc', () => {
    useBuildingMock.mockReturnValue({ data: makeBuilding(), isLoading: false });
    useBlocksMock.mockReturnValue({ data: [], isLoading: false });

    render(<BuildingDetailView buildingId="building-1" />);
    expect(
      screen.getByText('Aucun bloc — les bandes peuvent être rattachées directement à ce bâtiment.'),
    ).toBeInTheDocument();
  });

  it('propose Nouveau bloc quand BUILDINGS_CREATE est présent', () => {
    useBuildingMock.mockReturnValue({ data: makeBuilding(), isLoading: false });
    useBlocksMock.mockReturnValue({ data: [makeBlock()], isLoading: false });

    render(<BuildingDetailView buildingId="building-1" />);
    expect(screen.getByRole('button', { name: /Nouveau bloc/ })).toBeInTheDocument();
  });

  it('masque Nouveau bloc sans BUILDINGS_CREATE', () => {
    mockPermissions = [];
    useBuildingMock.mockReturnValue({ data: makeBuilding(), isLoading: false });
    useBlocksMock.mockReturnValue({ data: [makeBlock()], isLoading: false });

    render(<BuildingDetailView buildingId="building-1" />);
    expect(screen.queryByRole('button', { name: /Nouveau bloc/ })).not.toBeInTheDocument();
  });

  it('ouvre la confirmation de suppression d’un bloc au clic sur Supprimer', () => {
    useBuildingMock.mockReturnValue({ data: makeBuilding(), isLoading: false });
    useBlocksMock.mockReturnValue({ data: [makeBlock()], isLoading: false });

    render(<BuildingDetailView buildingId="building-1" />);
    const deleteButtons = screen.getAllByRole('button');
    const trashButton = deleteButtons.find((b) => b.querySelector('svg.lucide-trash2'));
    expect(trashButton).toBeDefined();
    fireEvent.click(trashButton!);

    expect(screen.getByText(/sera définitivement supprimé/)).toBeInTheDocument();
  });
});
