'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { AppBottomNav } from './app-bottom-nav';

/**
 * Hauteur bornée à la fenêtre (`h-screen` + `overflow-hidden`, pas
 * `min-h-screen`) : seule `<main>` (ou, sur le Tableau de bord, la zone
 * sous son en-tête — voir page.tsx) défile réellement. Sans cette
 * contrainte, rien ne clippe le débordement et c'est tout le document qui
 * défile, en-tête (AppTopbar) compris.
 *
 * Sur le Tableau de bord ("/"), AppTopbar s'efface déjà (fusionné dans
 * DashboardHeader, Lot 4) : `<main>` n'a alors ni padding ni défilement
 * propres — la page elle-même isole sa ligne d'en-tête (hors flux
 * scrollable, comme AppTopbar) de sa zone de contenu défilante, pour que
 * l'ascenseur ne couvre jamais que cette dernière.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname === '/';

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />

      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <AppTopbar />
        <main
          className={cn(
            'min-h-0 flex-1',
            isDashboard ? 'overflow-hidden' : 'overflow-y-auto p-4 pb-20 md:p-6 md:pb-6',
          )}
        >
          {children}
        </main>
      </div>

      <AppBottomNav />
    </div>
  );
}
