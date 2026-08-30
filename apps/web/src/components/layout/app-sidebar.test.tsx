import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { AppSidebar } from './app-sidebar';

const ALL_PERMISSIONS = [
  PERMISSIONS.WATER_POINTS_READ,
  PERMISSIONS.BROILER_BATCHES_READ,
  PERMISSIONS.LAYER_BATCHES_READ,
  PERMISSIONS.ITEMS_READ,
  PERMISSIONS.PURCHASE_ORDERS_READ,
  PERMISSIONS.EXPENSES_READ,
  PERMISSIONS.TREASURY_READ,
  PERMISSIONS.ASSETS_READ,
  PERMISSIONS.MAINTENANCE_TASKS_READ,
];

const pathnameMock = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

let mockPermissions: string[] = [];
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { permissions: mockPermissions } }),
}));

describe('AppSidebar', () => {
  it('renders every category label when the user has at least one permission per category', () => {
    mockPermissions = ALL_PERMISSIONS;
    pathnameMock.mockReturnValue('/');
    render(<AppSidebar />);

    expect(screen.getByText('Élevage')).toBeInTheDocument();
    expect(screen.getByText('Finances')).toBeInTheDocument();
    expect(screen.getByText('Équipements')).toBeInTheDocument();
    expect(screen.getByText('Stocks')).toBeInTheDocument();
  });

  it('auto-expands only the category containing the active route, others stay collapsed', () => {
    mockPermissions = ALL_PERMISSIONS;
    pathnameMock.mockReturnValue('/pondeuses');
    render(<AppSidebar />);

    // Élevage contient /pondeuses (route active) : son enfant est visible.
    expect(screen.getByText('Pondeuses')).toBeInTheDocument();
    // Finances ne contient pas la route active : replié par défaut, ses
    // enfants ne sont pas rendus dans le DOM.
    expect(screen.queryByText('Dépenses')).not.toBeInTheDocument();
    expect(screen.queryByText('Trésorerie')).not.toBeInTheDocument();
  });

  it('toggles a category open and closed on trigger click', () => {
    mockPermissions = ALL_PERMISSIONS;
    pathnameMock.mockReturnValue('/');
    render(<AppSidebar />);

    expect(screen.queryByText('Dépenses')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Finances'));
    expect(screen.getByText('Dépenses')).toBeInTheDocument();
    expect(screen.getByText('Trésorerie')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Finances'));
    expect(screen.queryByText('Dépenses')).not.toBeInTheDocument();
  });

  it('hides a category entirely when the user has none of its children permissions', () => {
    mockPermissions = [];
    pathnameMock.mockReturnValue('/');
    render(<AppSidebar />);

    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    expect(screen.queryByText('Élevage')).not.toBeInTheDocument();
    expect(screen.queryByText('Finances')).not.toBeInTheDocument();
    expect(screen.queryByText('Équipements')).not.toBeInTheDocument();
    expect(screen.queryByText('Stocks')).not.toBeInTheDocument();
  });
});
