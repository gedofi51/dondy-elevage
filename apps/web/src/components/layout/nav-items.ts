import type { LucideIcon } from 'lucide-react';
import {
  Bird,
  Boxes,
  ClipboardCheck,
  Droplets,
  Egg,
  EggFried,
  Feather,
  Landmark,
  LayoutDashboard,
  LineChart,
  Package,
  Receipt,
  Settings2,
  ShoppingCart,
  Sprout,
  Thermometer,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { PermissionCode } from '@dondy-elevage/shared-types';
import { PERMISSIONS } from '@dondy-elevage/shared-types';

export interface NavLink {
  type: 'link';
  label: string;
  href: string;
  icon: LucideIcon;
  /** Omis = toujours visible (ex. tableau de bord). */
  permission?: PermissionCode;
  /** Visible si l'utilisateur a AU MOINS UNE de ces permissions — alternative
   * à `permission` (exclusif entre les deux) pour une entrée qui doit rester
   * atteignable par plusieurs profils sans permission commune unique (voir
   * « Pointage », Lot 6b, et DETTE_TECHNIQUE.md). */
  anyPermission?: PermissionCode[];
}

export interface NavCategory {
  type: 'category';
  label: string;
  icon: LucideIcon;
  items: NavLink[];
}

export type NavEntry = NavLink | NavCategory;

// Phase 21 — regroupement en catégories dépliables (mockup "1a — Agritech
// Premium", docs/design/). Règle appliquée uniformément : une entrée
// devient NavCategory seulement si elle agrège ≥2 routes de premier niveau
// réelles, sinon elle reste un NavLink direct (voir DETTE_TECHNIQUE.md
// Phase 21 pour les écarts au mockup : "Santé"/"Ventes" n'ont pas de route
// dédiée, "Personnel"/"Rapports" n'existent pas).
export const navItems: NavEntry[] = [
  { type: 'link', label: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  // Prévisions (Lot 3) — écran transverse Production+Finance, une seule
  // route de premier niveau : reste un NavLink direct (même règle que
  // Points d'eau/Stocks/Achats). Placée juste après Tableau de bord (même
  // nature "vue d'ensemble") plutôt que dans une catégorie existante —
  // elle ne relève d'aucune des trois (Élevage/Finances/Équipements)
  // exclusivement, voir DETTE_TECHNIQUE.md Lot 3. anyPermission (au moins
  // une des 3 permissions de domaine) : reste atteignable même pour un
  // rôle qui n'a accès qu'à une seule des deux sections de l'écran.
  {
    type: 'link',
    label: 'Prévisions',
    href: '/previsions',
    icon: LineChart,
    anyPermission: [
      PERMISSIONS.BROILER_BATCHES_READ,
      PERMISSIONS.LAYER_BATCHES_READ,
      PERMISSIONS.TREASURY_READ,
    ],
  },
  {
    type: 'link',
    label: "Points d'eau",
    href: '/points-eau',
    icon: Droplets,
    permission: PERMISSIONS.WATER_POINTS_READ,
  },
  {
    type: 'category',
    label: 'Élevage',
    icon: Sprout,
    items: [
      {
        type: 'link',
        label: 'Poulets de chair',
        href: '/poulets-chair',
        icon: Bird,
        permission: PERMISSIONS.BROILER_BATCHES_READ,
      },
      {
        type: 'link',
        label: 'Pondeuses',
        href: '/pondeuses',
        icon: Egg,
        permission: PERMISSIONS.LAYER_BATCHES_READ,
      },
      {
        type: 'link',
        label: 'Reproducteurs',
        href: '/reproducteurs',
        icon: Feather,
        permission: PERMISSIONS.BREEDER_BATCHES_READ,
      },
      {
        type: 'link',
        label: 'Couveuses',
        href: '/couveuses',
        icon: Thermometer,
        permission: PERMISSIONS.INCUBATORS_READ,
      },
      {
        type: 'link',
        label: 'Couvoir',
        href: '/couvoir',
        icon: EggFried,
        permission: PERMISSIONS.INCUBATION_BATCHES_READ,
      },
      {
        type: 'link',
        label: 'Poussins',
        href: '/poussins',
        icon: Bird,
        permission: PERMISSIONS.CHICK_BATCHES_READ,
      },
    ],
  },
  {
    type: 'link',
    label: 'Stocks',
    href: '/stocks',
    icon: Package,
    permission: PERMISSIONS.ITEMS_READ,
  },
  {
    type: 'link',
    label: 'Achats',
    href: '/achats',
    icon: ShoppingCart,
    permission: PERMISSIONS.PURCHASE_ORDERS_READ,
  },
  {
    type: 'category',
    label: 'Finances',
    icon: Landmark,
    items: [
      {
        type: 'link',
        label: 'Dépenses',
        href: '/depenses',
        icon: Receipt,
        permission: PERMISSIONS.EXPENSES_READ,
      },
      {
        type: 'link',
        label: 'Trésorerie',
        href: '/tresorerie',
        icon: Wallet,
        permission: PERMISSIONS.TREASURY_READ,
      },
    ],
  },
  {
    type: 'category',
    label: 'Équipements',
    icon: Settings2,
    items: [
      {
        type: 'link',
        label: 'Patrimoine',
        href: '/patrimoine',
        icon: Boxes,
        permission: PERMISSIONS.ASSETS_READ,
      },
      {
        type: 'link',
        label: 'Maintenance',
        href: '/maintenance',
        icon: Wrench,
        permission: PERMISSIONS.MAINTENANCE_TASKS_READ,
      },
    ],
  },
  // Personnel (Lot 6a) — une seule route de premier niveau (/personnel) :
  // reste un NavLink direct, même règle que Points d'eau/Stocks/Achats
  // (voir DETTE_TECHNIQUE.md Lot 6a pour le détail de ce choix et son
  // effet de bord connu sur le rôle Responsable élevage).
  {
    type: 'link',
    label: 'Personnel',
    href: '/personnel',
    icon: Users,
    permission: PERMISSIONS.EMPLOYEES_READ,
  },
  // Pointage (Lot 6b) — entrée séparée de « Personnel », gated par
  // anyPermission (ATTENDANCE_READ OU EMPLOYEE_TASKS_READ) plutôt que par
  // EMPLOYEES_READ : corrige un trou de navigation identifié avant ce lot
  // — le rôle Responsable élevage a ATTENDANCE_READ/EMPLOYEE_TASKS_READ
  // mais pas EMPLOYEES_READ, et ne voyait donc jamais « Personnel » malgré
  // un accès API réel au pointage. Dans la matrice RBAC actuelle
  // (roles.catalog.ts), ces deux permissions sont toujours accordées
  // ensemble à chaque rôle qui en a une — gater sur ATTENDANCE_READ seul
  // donnerait donc exactement la même visibilité aujourd'hui ; le OU est
  // conservé pour rester correct si un futur rôle (ou le Lot 6c, Tâches)
  // découple un jour les deux permissions. Voir DETTE_TECHNIQUE.md Lot 6b.
  {
    type: 'link',
    label: 'Pointage',
    href: '/pointage',
    icon: ClipboardCheck,
    anyPermission: [PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.EMPLOYEE_TASKS_READ],
  },
];

// Le payload JWT (AccessTokenPayload.permissions, packages/shared-types)
// type ce champ en `string[]` large, pas `PermissionCode[]` — la vérif
// d'appartenance reste sûre (PermissionCode est un sous-ensemble de
// string), mais la signature doit accepter le type réel envoyé par
// useAuth() sous peine d'erreur TypeScript côté appelant.
function isLinkVisible(item: NavLink, permissions: string[] | undefined): boolean {
  if (item.anyPermission) {
    return item.anyPermission.some((p) => permissions?.includes(p) ?? false);
  }
  return !item.permission || (permissions?.includes(item.permission) ?? false);
}

/**
 * Filtre navItems par permissions : un NavLink disparaît si sa permission
 * manque, une NavCategory disparaît entièrement si aucun de ses enfants ne
 * reste visible (jamais affichée vide) — même filtre pour la sidebar
 * desktop et la barre mobile, mutualisé ici pour éviter la duplication
 * qui existait entre app-sidebar.tsx et app-bottom-nav.tsx avant la
 * Phase 21.
 */
export function getVisibleNavEntries(permissions: string[] | undefined): NavEntry[] {
  const result: NavEntry[] = [];
  for (const entry of navItems) {
    if (entry.type === 'link') {
      if (isLinkVisible(entry, permissions)) {
        result.push(entry);
      }
      continue;
    }
    const visibleItems = entry.items.filter((item) => isLinkVisible(item, permissions));
    if (visibleItems.length > 0) {
      result.push({ ...entry, items: visibleItems });
    }
  }
  return result;
}

/** Aplatissement de navItems (catégories dépliées en leurs enfants,
 * ordre préservé) — consommé par AppBottomNav, qui garde un patron à plat
 * (voir DETTE_TECHNIQUE.md Phase 13/Phase 21 : pas de sous-navigation à 2
 * niveaux sur mobile cette phase). */
export const flatNavItems: NavLink[] = navItems.flatMap((entry) =>
  entry.type === 'link' ? [entry] : entry.items,
);

/** Une route est "active" si elle correspond exactement à href, ou si
 * c'est un préfixe de segment (ex. /pondeuses/abc/suivi/2026-08-30 est
 * actif pour href="/pondeuses"). Cas spécial "/" obligatoire : sans lui,
 * startsWith('/') matcherait Tableau de bord sur toute route. */
export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
