'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function AppTopbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/connexion');
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <p className="text-sm font-medium text-foreground">Tableau de bord</p>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <User className="h-4 w-4" aria-hidden="true" />
              Compte
            </Button>
          }
        />
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
    </header>
  );
}
