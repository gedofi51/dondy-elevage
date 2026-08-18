import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Volontairement minimal en Phase 0 (fondations uniquement) : les modules
// métier (élevage, stocks, finances...) rejoindront cette liste à partir de
// la Phase 3, module par module.
export const navItems: NavItem[] = [{ label: 'Tableau de bord', href: '/', icon: LayoutDashboard }];
