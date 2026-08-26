import type { LucideIcon } from 'lucide-react';
import {
  Bird,
  Boxes,
  Droplets,
  Egg,
  EggFried,
  Feather,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Thermometer,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { PermissionCode } from '@dondy-elevage/shared-types';
import { PERMISSIONS } from '@dondy-elevage/shared-types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Omis = toujours visible (ex. tableau de bord). */
  permission?: PermissionCode;
}

// Modules métier ajoutés progressivement à partir de la Phase 9 (Eau —
// premier module complet), un par un dans les phases suivantes.
export const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { label: "Points d'eau", href: '/points-eau', icon: Droplets, permission: PERMISSIONS.WATER_POINTS_READ },
  {
    label: 'Poulets de chair',
    href: '/poulets-chair',
    icon: Bird,
    permission: PERMISSIONS.BROILER_BATCHES_READ,
  },
  {
    label: 'Pondeuses',
    href: '/pondeuses',
    icon: Egg,
    permission: PERMISSIONS.LAYER_BATCHES_READ,
  },
  {
    label: 'Reproducteurs',
    href: '/reproducteurs',
    icon: Feather,
    permission: PERMISSIONS.BREEDER_BATCHES_READ,
  },
  {
    label: 'Couveuses',
    href: '/couveuses',
    icon: Thermometer,
    permission: PERMISSIONS.INCUBATORS_READ,
  },
  {
    label: 'Couvoir',
    href: '/couvoir',
    icon: EggFried,
    permission: PERMISSIONS.INCUBATION_BATCHES_READ,
  },
  {
    label: 'Poussins',
    href: '/poussins',
    icon: Bird,
    permission: PERMISSIONS.CHICK_BATCHES_READ,
  },
  {
    label: 'Stocks',
    href: '/stocks',
    icon: Package,
    permission: PERMISSIONS.ITEMS_READ,
  },
  {
    label: 'Achats',
    href: '/achats',
    icon: ShoppingCart,
    permission: PERMISSIONS.PURCHASE_ORDERS_READ,
  },
  {
    label: 'Dépenses',
    href: '/depenses',
    icon: Receipt,
    permission: PERMISSIONS.EXPENSES_READ,
  },
  {
    label: 'Trésorerie',
    href: '/tresorerie',
    icon: Wallet,
    permission: PERMISSIONS.TREASURY_READ,
  },
  {
    label: 'Patrimoine',
    href: '/patrimoine',
    icon: Boxes,
    permission: PERMISSIONS.ASSETS_READ,
  },
  {
    label: 'Maintenance',
    href: '/maintenance',
    icon: Wrench,
    permission: PERMISSIONS.MAINTENANCE_TASKS_READ,
  },
];
