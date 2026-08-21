import type { ReactNode } from 'react';
import { Feather } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted px-4 py-12">
      <div className="flex items-center gap-2">
        <Feather className="h-6 w-6 text-primary" aria-hidden="true" />
        <div className="leading-tight">
          <p className="font-semibold tracking-wide text-foreground">DONDY</p>
          <p className="text-xs text-muted-foreground">ÉLEVAGE</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
