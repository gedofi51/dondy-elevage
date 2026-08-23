import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground ring-2 ring-accent/50"
          aria-hidden="true"
        >
          DE
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
