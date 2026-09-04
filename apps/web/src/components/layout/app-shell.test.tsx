import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';
import { AuthProvider } from '@/components/providers/auth-provider';

// AppTopbar utilise useRouter (next/navigation) pour la redirection après
// déconnexion et usePathname pour savoir s'il doit s'effacer sur le
// Tableau de bord (fusionné dans DashboardHeader, voir app-topbar.tsx) ;
// AppSidebar utilise usePathname (Phase 21, état actif/dépli des
// catégories) — ni l'un ni l'autre n'est fonctionnel hors d'une app
// Next.js montée, à mocker pour ce test de rendu isolé (aucune navigation
// n'y est exercée). Route non-Tableau de bord volontairement choisie ici
// pour vérifier le fil d'ariane "normal" (non-régression) — le
// comportement spécifique à `/` est couvert par app-topbar.test.tsx.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/stocks',
}));

describe('AppShell', () => {
  it('renders the navigation and the page content, with the shared topbar (fil d’ariane + Compte) on a non-dashboard route', async () => {
    render(
      <AuthProvider>
        <AppShell>
          <p>Contenu de la page</p>
        </AppShell>
      </AuthProvider>,
    );

    expect(await screen.findAllByText('Tableau de bord')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: /Compte/ })).toBeInTheDocument();
    expect(screen.getByText('Contenu de la page')).toBeInTheDocument();
  });
});
