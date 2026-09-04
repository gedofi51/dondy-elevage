import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppTopbar } from './app-topbar';

let mockPathname = '/stocks';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { roles: ['Propriétaire / Administrateur'] }, logout: vi.fn() }),
}));

describe('AppTopbar', () => {
  it('affiche le fil d’ariane et le bouton Compte sur les écrans autres que le Tableau de bord', async () => {
    mockPathname = '/stocks';
    render(<AppTopbar />);

    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Compte/ }));
    expect(await screen.findByText('Se déconnecter')).toBeInTheDocument();
  });

  it('ne s’affiche pas sur le Tableau de bord (fusionné dans DashboardHeader)', () => {
    mockPathname = '/';
    const { container } = render(<AppTopbar />);
    expect(container).toBeEmptyDOMElement();
  });
});
