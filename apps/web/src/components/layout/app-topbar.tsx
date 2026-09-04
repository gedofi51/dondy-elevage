'use client';

import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountMenu } from './account-menu';

/**
 * Fil d'ariane + accès Compte, commun à tout l'espace applicatif — sauf le
 * Tableau de bord (route `/`), où cette ligne est fusionnée dans
 * `DashboardHeader` (dont l'avatar réutilise ce même `AccountMenu`) pour
 * éviter un doublon "Tableau de bord" + deux points d'accès au Compte.
 */
export function AppTopbar() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <p className="text-sm font-medium text-foreground">Tableau de bord</p>

      <AccountMenu
        trigger={
          <Button variant="outline" size="sm">
            <User className="h-4 w-4" aria-hidden="true" />
            Compte
          </Button>
        }
      />
    </header>
  );
}
