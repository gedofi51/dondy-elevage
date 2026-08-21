'use client';

import type { PermissionCode } from '@dondy-elevage/shared-types';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/providers/auth-provider';

interface CanProps {
  permission: PermissionCode;
  children: ReactNode;
  /** Affiché si la permission est absente — sinon rien n'est rendu. */
  fallback?: ReactNode;
}

/** Masque/désactive une action selon les permissions du JWT décodé —
 * purement cosmétique, jamais la seule barrière : PermissionsGuard côté
 * API reste la vraie autorisation (voir CONTRAINTES.md). */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { user } = useAuth();
  if (!user?.permissions.includes(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
