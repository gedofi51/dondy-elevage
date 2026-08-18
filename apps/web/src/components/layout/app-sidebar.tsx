import Link from 'next/link';
import { Feather } from 'lucide-react';
import { navItems } from './nav-items';

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 px-6 py-5">
        <Feather className="h-6 w-6 text-sidebar-primary" aria-hidden="true" />
        <div className="leading-tight">
          <p className="font-semibold tracking-wide">DONDY</p>
          <p className="text-xs text-sidebar-foreground/70">ÉLEVAGE</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-6 py-4 text-xs text-sidebar-foreground/60">
        Modules métier disponibles à partir de la Phase 3.
      </div>
    </aside>
  );
}
