import { Button } from '@/components/ui/button';

export function AppTopbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <p className="text-sm font-medium text-foreground">Tableau de bord</p>

      {/* Compte/auth finalisés en Phase 1 — placeholder non fonctionnel pour l'instant. */}
      <Button variant="outline" size="sm" disabled>
        Compte
      </Button>
    </header>
  );
}
