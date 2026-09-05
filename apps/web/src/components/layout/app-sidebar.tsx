'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getVisibleNavEntries, isNavLinkActive, type NavLink } from './nav-items';
import { useAuth } from '@/components/providers/auth-provider';

function SidebarLink({ item, pathname }: { item: NavLink; pathname: string }) {
  const Icon = item.icon;
  const isActive = isNavLinkActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/90 transition-colors',
        isActive
          ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function findActiveCategoryLabel(pathname: string, entries: ReturnType<typeof getVisibleNavEntries>): string | null {
  const activeCategory = entries.find(
    (entry) => entry.type === 'category' && entry.items.some((item) => isNavLinkActive(pathname, item.href)),
  );
  return activeCategory?.label ?? null;
}

export function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const visibleEntries = useMemo(() => getVisibleNavEntries(user?.permissions), [user?.permissions]);

  // Déplie automatiquement la catégorie contenant la route active, sans
  // jamais refermer une catégorie ouverte manuellement par ailleurs (union,
  // pas remplacement) — état ajusté PENDANT le rendu (pas dans un effect,
  // pattern recommandé par React pour dériver un état d'un changement de
  // pathname : https://react.dev/learn/you-might-not-need-an-effect), un
  // `useEffect` avec `setState` synchrone y déclenchait des rendus en
  // cascade signalés par le linter React Compiler.
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const initialActive = findActiveCategoryLabel(pathname, visibleEntries);
    return initialActive ? new Set([initialActive]) : new Set();
  });
  const [trackedPathname, setTrackedPathname] = useState(pathname);
  if (pathname !== trackedPathname) {
    setTrackedPathname(pathname);
    const activeLabel = findActiveCategoryLabel(pathname, visibleEntries);
    if (activeLabel && !openCategories.has(activeLabel)) {
      setOpenCategories(new Set(openCategories).add(activeLabel));
    }
  }

  function setCategoryOpen(label: string, open: boolean) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (open) {
        next.add(label);
      } else {
        next.delete(label);
      }
      return next;
    });
  }

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-3 px-4 pt-[22px] pb-[22px]">
        {/* Fond blanc arrondi : le logo a un fond blanc/crème (pas de
            transparence, voir docs/architecture/DESIGN_SYSTEM.md) — sans
            lui, ses bords carrés trancheraient sur le vert sombre de la
            sidebar une fois recadrés en cercle. */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 ring-2 ring-sidebar-primary/50">
          <Image
            src="/logo_dondy_elevage.png"
            alt="Dondy Élevage"
            width={40}
            height={40}
            className="h-full w-full rounded-full object-cover"
            priority
          />
        </span>
        <div className="leading-tight">
          <p className="font-heading text-lg font-semibold text-sidebar-foreground">Dondy Élevage</p>
          <p className="text-[11px] tracking-wide text-sidebar-foreground/70">FERME DE SAMBA</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-0.5 px-3 py-2">
        {visibleEntries.map((entry) => {
          if (entry.type === 'link') {
            return <SidebarLink key={entry.href} item={entry} pathname={pathname} />;
          }

          const Icon = entry.icon;
          const isOpen = openCategories.has(entry.label);
          return (
            <Collapsible
              key={entry.label}
              open={isOpen}
              onOpenChange={(open) => setCategoryOpen(entry.label, open)}
            >
              <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-0.5 py-0.5 pl-[26px]">
                {entry.items.map((item) => (
                  <SidebarLink key={item.href} item={item} pathname={pathname} />
                ))}
              </CollapsiblePanel>
            </Collapsible>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-6 py-4 text-xs text-sidebar-foreground/60">
        Modules métier ajoutés progressivement, un par un.
      </div>
    </aside>
  );
}
