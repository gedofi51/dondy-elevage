import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { flatNavItems, getVisibleNavEntries, isNavLinkActive, navItems } from './nav-items';

describe('getVisibleNavEntries', () => {
  it('always includes links without a permission requirement (ex. Tableau de bord)', () => {
    const visible = getVisibleNavEntries(undefined);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/')).toBe(true);
  });

  it('hides a direct link when its permission is missing', () => {
    const visible = getVisibleNavEntries([]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/stocks')).toBe(false);
  });

  it('shows a direct link when its permission is present', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.ITEMS_READ]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/stocks')).toBe(true);
  });

  it('hides an entire category when none of its children are allowed', () => {
    const visible = getVisibleNavEntries([]);
    expect(visible.some((entry) => entry.type === 'category' && entry.label === 'Équipements')).toBe(false);
  });

  it('keeps a category, filtered to only the allowed children, when at least one child is allowed', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.ASSETS_READ]);
    const equipements = visible.find((entry) => entry.type === 'category' && entry.label === 'Équipements');
    expect(equipements).toBeDefined();
    if (equipements?.type !== 'category') {
      throw new Error('Équipements devrait être une catégorie');
    }
    expect(equipements.items.map((item) => item.href)).toEqual(['/patrimoine']);
  });

  it('keeps every child of a category when every permission is granted', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.ASSETS_READ, PERMISSIONS.MAINTENANCE_TASKS_READ]);
    const equipements = visible.find((entry) => entry.type === 'category' && entry.label === 'Équipements');
    if (equipements?.type !== 'category') {
      throw new Error('Équipements devrait être une catégorie');
    }
    expect(equipements.items.map((item) => item.href)).toEqual(['/patrimoine', '/maintenance']);
  });

  // Pointage (Lot 6b) — anyPermission (ATTENDANCE_READ OU EMPLOYEE_TASKS_READ),
  // cas explicitement visé : le rôle Responsable élevage a l'un et l'autre
  // mais pas EMPLOYEES_READ.
  it('shows a link gated by anyPermission when only the first permission is present (cas Responsable élevage)', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.ATTENDANCE_READ]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/pointage')).toBe(true);
    // Et « Personnel » (gated par EMPLOYEES_READ) reste bien absent — c'est
    // précisément le trou de navigation que « Pointage » corrige.
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/personnel')).toBe(false);
  });

  it('shows a link gated by anyPermission when only the second permission is present', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.EMPLOYEE_TASKS_READ]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/pointage')).toBe(true);
  });

  it('hides a link gated by anyPermission when neither permission is present', () => {
    const visible = getVisibleNavEntries([]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/pointage')).toBe(false);
  });

  // Prévisions (Lot 3) — anyPermission sur 3 domaines (Broiler/Layer/
  // Treasury) : reste atteignable pour un rôle qui n'a accès qu'à un seul
  // des deux volets de l'écran (Production ou Finance).
  it('shows "Prévisions" when only one of its three anyPermission domains is present', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.TREASURY_READ]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/previsions')).toBe(true);
  });

  it('hides "Prévisions" when none of its three anyPermission domains is present', () => {
    const visible = getVisibleNavEntries([]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/previsions')).toBe(false);
  });

  // Anomalies (Lot 4) — permission unique (ALERTS_READ), pas anyPermission.
  it('shows "Anomalies" when ALERTS_READ is present', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.ALERTS_READ]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/anomalies')).toBe(true);
  });

  it('hides "Anomalies" when ALERTS_READ is absent', () => {
    const visible = getVisibleNavEntries([]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/anomalies')).toBe(false);
  });

  // Comparaison (Lot 4) — anyPermission sur 3 domaines (Broiler/Layer/
  // Incubation) : reste atteignable pour un rôle qui n'a accès qu'à un seul.
  it('shows "Comparaison" when only one of its three anyPermission domains is present', () => {
    const visible = getVisibleNavEntries([PERMISSIONS.INCUBATION_BATCHES_READ]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/comparaison')).toBe(true);
  });

  it('hides "Comparaison" when none of its three anyPermission domains is present', () => {
    const visible = getVisibleNavEntries([]);
    expect(visible.some((entry) => entry.type === 'link' && entry.href === '/comparaison')).toBe(false);
  });
});

describe('flatNavItems', () => {
  it('contains exactly the 19 real routes (12 top-level links/categories flattened)', () => {
    expect(flatNavItems).toHaveLength(19);
  });

  it('preserves the order of navItems, expanding categories in place', () => {
    const elevageIndex = navItems.findIndex((entry) => entry.type === 'category' && entry.label === 'Élevage');
    const elevage = navItems[elevageIndex];
    const firstChild = elevage?.type === 'category' ? elevage.items[0] : undefined;
    if (!firstChild) {
      throw new Error('Élevage devrait être une catégorie avec au moins un enfant');
    }
    const flatIndex = flatNavItems.findIndex((item) => item.href === firstChild.href);
    // "Points d'eau" (lien direct) précède la catégorie Élevage dans
    // navItems — son unique enfant aplati doit donc apparaître juste
    // après lui dans flatNavItems, pas avant.
    const waterPointsIndex = flatNavItems.findIndex((item) => item.href === '/points-eau');
    expect(flatIndex).toBe(waterPointsIndex + 1);
  });
});

describe('isNavLinkActive', () => {
  it('matches "/" only on an exact match', () => {
    expect(isNavLinkActive('/', '/')).toBe(true);
    expect(isNavLinkActive('/stocks', '/')).toBe(false);
  });

  it('matches an exact route', () => {
    expect(isNavLinkActive('/pondeuses', '/pondeuses')).toBe(true);
  });

  it('matches a nested route under the same segment prefix', () => {
    expect(isNavLinkActive('/pondeuses/abc123/suivi/2026-08-30', '/pondeuses')).toBe(true);
  });

  it('does not match a different top-level route with a shared prefix', () => {
    expect(isNavLinkActive('/pondeuses-export', '/pondeuses')).toBe(false);
  });

  it('does not match an unrelated route', () => {
    expect(isNavLinkActive('/achats', '/pondeuses')).toBe(false);
  });
});
