'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DashboardSearchEntry {
  id: string;
  code: string;
  typeLabel: string;
  href: string;
}

function todayLabelFr(): string {
  const label = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Initiales dérivées du rôle (ex. "Propriétaire / Administrateur" -> "PA")
 * — le JWT décodé (AccessTokenPayload) ne porte ni nom ni email de
 * l'utilisateur (recherché : aucun endpoint `GET /users/me` ni hook
 * `useCurrentUser` dans le projet), donc "avatar initiales + nom" du
 * mockup n'a pas d'équivalent réel. Repli sur le même contenu déjà
 * affiché par AppTopbar (`user.roles`), pas un nom inventé. */
function initialsFromRole(role: string | undefined): string {
  if (!role) return '·';
  return (
    role
      .split(/[\s/]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || '·'
  );
}

/**
 * En-tête du Tableau de bord (maquette 1a) — titre statique, date du jour
 * + nombre de bandes actives en temps réel, recherche fonctionnelle
 * (filtre côté client sur les bandes déjà chargées par la page, navigue
 * vers la fiche au clic/Entrée — aucun endpoint de recherche n'existe,
 * jamais une recherche factice), cloche de notifications réutilisant le
 * total d'alertes actives déjà récupéré pour AlertsPanel (ancre vers ce
 * panneau, pas un système de notification séparé — aucun n'existe côté
 * backend), badge de compte (voir initialsFromRole ci-dessus).
 */
export function DashboardHeader({
  activeBatchCount,
  searchIndex,
  alertsCount,
}: {
  activeBatchCount: number | undefined;
  searchIndex: DashboardSearchEntry[];
  alertsCount: number | undefined;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return searchIndex.filter((entry) => entry.code.toLowerCase().includes(trimmed)).slice(0, 6);
  }, [query, searchIndex]);

  function goTo(entry: DashboardSearchEntry) {
    router.push(entry.href);
    setQuery('');
  }

  const roleLabel = user?.roles[0];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-primary">Bonjour, aperçu du jour</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {todayLabelFr()}
          {activeBatchCount !== undefined
            ? ` · ${activeBatchCount} bande${activeBatchCount > 1 ? 's' : ''} en activité`
            : null}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) goTo(matches[0]);
            }}
            placeholder="Rechercher une bande, un lot…"
            aria-label="Rechercher une bande, un lot"
            className="h-10 pl-9"
          />
          {matches.length > 0 ? (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover py-1 shadow-card">
              {matches.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => goTo(entry)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-popover-foreground hover:bg-muted"
                  >
                    <span className="font-medium">{entry.code}</span>
                    <span className="text-xs text-muted-foreground">{entry.typeLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <a
          href="#alertes"
          className={cn(
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground',
            'hover:bg-muted',
          )}
          aria-label={
            alertsCount ? `${alertsCount} alerte(s) active(s) — aller aux alertes` : 'Aucune alerte active'
          }
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {alertsCount ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {alertsCount > 9 ? '9+' : alertsCount}
            </span>
          ) : null}
        </a>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {initialsFromRole(roleLabel)}
          </span>
          <span className="hidden text-xs font-medium text-foreground sm:inline">{roleLabel ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
