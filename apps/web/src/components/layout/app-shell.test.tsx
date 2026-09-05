import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';
import { AuthProvider } from '@/components/providers/auth-provider';

// AppTopbar utilise useRouter (next/navigation) pour la redirection après
// déconnexion et usePathname pour savoir s'il doit s'effacer sur le
// Tableau de bord (fusionné dans DashboardHeader, voir app-topbar.tsx) ;
// AppShell lui-même utilise usePathname pour adapter le modèle de
// défilement de `<main>` (Lot 5 — en-tête fixe/bordure) ; AppSidebar
// utilise usePathname (Phase 21, état actif/dépli des catégories) — aucun
// n'est fonctionnel hors d'une app Next.js montée, à mocker pour ce test
// de rendu isolé (aucune navigation n'y est exercée). `let` (plutôt qu'une
// constante) pour pouvoir faire varier la route d'un test à l'autre.
let mockPathname = '/stocks';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => mockPathname,
}));

describe('AppShell', () => {
  it('sur un écran normal (non-régression) : fil d’ariane + Compte, et `<main>` défile lui-même (padding + overflow-y-auto)', async () => {
    mockPathname = '/stocks';
    const { container } = render(
      <AuthProvider>
        <AppShell>
          <p>Contenu de la page</p>
        </AppShell>
      </AuthProvider>,
    );

    expect(await screen.findAllByText('Tableau de bord')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: /Compte/ })).toBeInTheDocument();
    expect(screen.getByText('Contenu de la page')).toBeInTheDocument();

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.className).toContain('overflow-y-auto');
    expect(main!.className).toContain('p-4');
  });

  it('sur le Tableau de bord ("/") : pas de fil d’ariane dupliqué, `<main>` ne défile plus lui-même (la page isole sa propre zone défilante)', async () => {
    mockPathname = '/';
    const { container } = render(
      <AuthProvider>
        <AppShell>
          <p>Contenu de la page</p>
        </AppShell>
      </AuthProvider>,
    );

    expect(screen.queryByRole('button', { name: /Compte/ })).not.toBeInTheDocument();
    expect(screen.getByText('Contenu de la page')).toBeInTheDocument();

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.className).toContain('overflow-hidden');
    expect(main!.className).not.toContain('overflow-y-auto');
    expect(main!.className).not.toContain('p-4');
  });
});
