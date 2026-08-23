'use client';

import Link from 'next/link';
import { navItems } from './nav-items';
import { useAuth } from '@/components/providers/auth-provider';

export function AppSidebar() {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) => !item.permission || user?.permissions.includes(item.permission));

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-3 px-4 pt-[22px] pb-[22px]">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground ring-2 ring-sidebar-primary/50"
          aria-hidden="true"
        >
          DE
        </span>
        <div className="leading-tight">
          <p className="font-heading text-lg font-semibold text-sidebar-foreground">Dondy Élevage</p>
          <p className="text-[11px] tracking-wide text-sidebar-foreground/70">FERME DE SAMBA</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-6 py-4 text-xs text-sidebar-foreground/60">
        Modules métier ajoutés progressivement, un par un.
      </div>
    </aside>
  );
}
