import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';
import { AuthProvider } from '@/components/providers/auth-provider';

// AppTopbar utilise useRouter (next/navigation) pour la redirection après
// déconnexion, AppSidebar utilise usePathname (Phase 21, état actif/dépli
// des catégories) — ni l'un ni l'autre n'est fonctionnel hors d'une app
// Next.js montée, à mocker pour ce test de rendu isolé (aucune navigation
// n'y est exercée).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}));

describe('AppShell', () => {
  it('renders the navigation and the page content', async () => {
    render(
      <AuthProvider>
        <AppShell>
          <p>Contenu de la page</p>
        </AppShell>
      </AuthProvider>,
    );

    expect(await screen.findAllByText('Tableau de bord')).not.toHaveLength(0);
    expect(screen.getByText('Contenu de la page')).toBeInTheDocument();
  });
});
