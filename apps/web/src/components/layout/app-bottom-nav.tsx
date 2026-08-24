'use client';

import Link from 'next/link';
import { navItems } from './nav-items';
import { useAuth } from '@/components/providers/auth-provider';

export function AppBottomNav() {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) => !item.permission || user?.permissions.includes(item.permission));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center gap-1 overflow-x-auto border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
      {/* overflow-x-auto + shrink-0 : au-delà de 4 modules (Phase 13 en
          ajoute 4 d'un coup), les items ne tiennent plus tous dans la
          largeur d'un mobile sans défiler — défensif, voir
          DETTE_TECHNIQUE.md Phase 13. */}
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex shrink-0 flex-col items-center gap-1 px-4 py-1 text-xs font-medium text-sidebar-foreground/90"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
