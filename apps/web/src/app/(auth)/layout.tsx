import type { ReactNode } from 'react';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <div className="flex items-center gap-3">
        {/* Fond blanc arrondi : le logo a un fond blanc/crème (pas de
            transparence, voir docs/architecture/DESIGN_SYSTEM.md) — même
            traitement que app-sidebar.tsx. */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 ring-2 ring-accent/50">
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
          <p className="font-heading text-lg font-semibold text-primary">Dondy Élevage</p>
          <p className="text-[11px] tracking-wide text-muted-foreground">FERME DE SAMBA</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
