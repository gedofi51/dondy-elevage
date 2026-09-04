import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHeader, type DashboardSearchEntry } from './dashboard-header';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

let mockUser: { roles: string[] } | null = { roles: ['Propriétaire / Administrateur'] };
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const searchIndex: DashboardSearchEntry[] = [
  { id: 'b1', code: 'PC-2026-001', typeLabel: 'Chair', href: '/poulets-chair/b1' },
  { id: 'b2', code: 'PON-2026-001', typeLabel: 'Ponte', href: '/pondeuses/b2' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { roles: ['Propriétaire / Administrateur'] };
});

describe('DashboardHeader', () => {
  it('affiche le titre statique et le nombre de bandes actives', () => {
    render(<DashboardHeader activeBatchCount={6} searchIndex={[]} alertsCount={0} />);
    expect(screen.getByText('Bonjour, aperçu du jour')).toBeInTheDocument();
    expect(screen.getByText(/6 bandes en activité/)).toBeInTheDocument();
  });

  it('n’affiche pas de nombre de bandes tant qu’il n’est pas résolu (jamais un chiffre inventé)', () => {
    render(<DashboardHeader activeBatchCount={undefined} searchIndex={[]} alertsCount={0} />);
    expect(screen.queryByText(/bande.*en activité/)).not.toBeInTheDocument();
  });

  it('la recherche filtre les bandes et navigue au clic sur un résultat', () => {
    render(<DashboardHeader activeBatchCount={2} searchIndex={searchIndex} alertsCount={0} />);
    fireEvent.change(screen.getByLabelText('Rechercher une bande, un lot'), {
      target: { value: 'pc-2026' },
    });
    const result = screen.getByText('PC-2026-001');
    expect(result).toBeInTheDocument();
    expect(screen.queryByText('PON-2026-001')).not.toBeInTheDocument();

    fireEvent.click(result);
    expect(pushMock).toHaveBeenCalledWith('/poulets-chair/b1');
  });

  it('la touche Entrée navigue vers le premier résultat', () => {
    render(<DashboardHeader activeBatchCount={2} searchIndex={searchIndex} alertsCount={0} />);
    const input = screen.getByLabelText('Rechercher une bande, un lot');
    fireEvent.change(input, { target: { value: 'PON' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/pondeuses/b2');
  });

  it('le badge de notifications affiche le nombre d’alertes actives réelles', () => {
    render(<DashboardHeader activeBatchCount={2} searchIndex={[]} alertsCount={4} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('aucun badge affiché quand il n’y a aucune alerte active', () => {
    render(<DashboardHeader activeBatchCount={2} searchIndex={[]} alertsCount={0} />);
    expect(screen.getByLabelText('Aucune alerte active')).toBeInTheDocument();
  });

  it('affiche les initiales et le libellé dérivés du rôle (pas de nom fabriqué)', () => {
    render(<DashboardHeader activeBatchCount={2} searchIndex={[]} alertsCount={0} />);
    expect(screen.getByText('PA')).toBeInTheDocument();
    expect(screen.getByText('Propriétaire / Administrateur')).toBeInTheDocument();
  });
});
