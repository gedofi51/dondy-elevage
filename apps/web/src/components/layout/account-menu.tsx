'use client';

import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/providers/auth-provider';

/**
 * Menu Compte (rôle(s) + déconnexion) — logique unique, partagée entre
 * `AppTopbar` (bouton "Compte", toutes les pages sauf le Tableau de bord)
 * et `DashboardHeader` (avatar cliquable, Tableau de bord uniquement) pour
 * ne jamais la dupliquer entre les deux en-têtes.
 */
export function AccountMenu({ trigger }: { trigger: ReactElement }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/connexion');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="end">
        {user ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {user.roles.join(', ')}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
