'use client';

import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountMenu } from './account-menu';
import { resolvePageTitle } from './nav-items';

/**
 * Fil d'ariane + accès Compte, commun à tout l'espace applicatif — sauf le
 * Tableau de bord (route `/`), où cette ligne est fusionnée dans
 * `DashboardHeader` (dont l'avatar réutilise ce même `AccountMenu`) pour
 * éviter un doublon "Tableau de bord" + deux points d'accès au Compte.
 *
 * Titre par page (`resolvePageTitle`, nav-items.ts) — jusqu'ici figé au
 * texte "Tableau de bord" sur TOUTES les pages hors le Tableau de bord
 * lui-même (régression corrigée ici). Recherche/cloche volontairement
 * absentes ici : elles appartiennent à `DashboardHeader` et sont liées à
 * des données que SEUL le Tableau de bord charge déjà (bandes chargées
 * pour la recherche, total d'alertes pour la cloche) — les étendre à
 * chaque page exigerait que chacune fournisse sa propre source de
 * recherche/alertes, hors périmètre de cette correction (voir
 * DETTE_TECHNIQUE.md).
 */
export function AppTopbar() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <p className="text-sm font-medium text-foreground">{resolvePageTitle(pathname)}</p>

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
