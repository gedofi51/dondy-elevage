import Link from 'next/link';
import { navItems } from './nav-items';

export function AppBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 px-4 py-1 text-xs font-medium text-sidebar-foreground/90"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
