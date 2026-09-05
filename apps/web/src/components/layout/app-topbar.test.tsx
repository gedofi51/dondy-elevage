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
  it('affiche le titre de la page courante (pas "Tableau de bord" figé) et le bouton Compte', async () => {
    mockPathname = '/stocks';
    render(<AppTopbar />);

    expect(screen.getByText('Stocks')).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Compte/ }));
    expect(await screen.findByText('Se déconnecter')).toBeInTheDocument();
  });

  // Une page différente doit afficher un titre différent — preuve que le
  // titre suit réellement la route (pas un texte figé quelconque).
  it('adapte le titre à chaque page (Personnel, Patrimoine)', () => {
    mockPathname = '/personnel';
    const { rerender } = render(<AppTopbar />);
    expect(screen.getByText('Personnel')).toBeInTheDocument();

    mockPathname = '/patrimoine';
    rerender(<AppTopbar />);
    expect(screen.getByText('Patrimoine')).toBeInTheDocument();
  });

  it('affiche le titre de la section parente sur une sous-route (fiche/formulaire)', () => {
    mockPathname = '/poulets-chair/abc123/vendre';
    render(<AppTopbar />);
    expect(screen.getByText('Poulets de chair')).toBeInTheDocument();
  });

  it('ne s’affiche pas sur le Tableau de bord (fusionné dans DashboardHeader)', () => {
    mockPathname = '/';
    const { container } = render(<AppTopbar />);
    expect(container).toBeEmptyDOMElement();
  });
});
