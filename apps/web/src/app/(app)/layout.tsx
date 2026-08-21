'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';

/** Garde d'authentification côté client : redirige vers /connexion si
 * aucune session valide. Purement UX (routes protégées côté serveur par
 * l'API elle-même, chaque appel échouerait de toute façon sans token
 * valide) — voir CONTRAINTES.md. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/connexion');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
