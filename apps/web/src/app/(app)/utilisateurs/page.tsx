'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { UserStatus } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUsers } from '@/features/users/hooks';
import { useRoles } from '@/features/roles/hooks';
import { userStatusLabels } from '@/features/users/schemas';
import type { PublicUser } from '@dondy-elevage/shared-types';

const ALL = '__ALL__';

const statusTones: Record<UserStatus, 'success' | 'info' | 'muted' | 'destructive'> = {
  ACTIVE: 'success',
  INVITED: 'info',
  INACTIVE: 'muted',
  SUSPENDED: 'destructive',
};

/**
 * Écran Utilisateurs (Administration) — liste des comptes de LA FERME de
 * l'acteur (isolation farmId déjà appliquée côté service, voir
 * UsersService.findAll). Filtres rôle/statut côté client — GET /users
 * n'a aucun paramètre de requête, et le nombre d'utilisateurs par ferme
 * reste modeste (pas de pagination serveur nécessaire).
 */
export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const { data: roles } = useRoles();
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const filtered = useMemo(() => {
    return (users ?? []).filter((u) => {
      if (statusFilter !== ALL && u.status !== statusFilter) return false;
      if (roleFilter !== ALL && !u.userRoles.some((ur) => ur.role.id === roleFilter)) return false;
      return true;
    });
  }, [users, roleFilter, statusFilter]);

  const columns: DataTableColumn<PublicUser>[] = [
    { key: 'name', header: 'Nom', render: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'roles',
      header: 'Rôle(s)',
      render: (u) => u.userRoles.map((ur) => ur.role.name).join(', ') || '—',
    },
    {
      key: 'status',
      header: 'Statut',
      render: (u) => <StatusBadge label={userStatusLabels[u.status]} tone={statusTones[u.status]} />,
    },
    {
      key: 'createdAt',
      header: 'Créé le',
      render: (u) => new Date(u.createdAt).toLocaleDateString('fr-FR'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Utilisateurs"
        description="Comptes ayant accès à l’espace DONDY ELEVAGE de votre ferme."
        action={
          <Can permission={PERMISSIONS.USERS_CREATE}>
            <Button nativeButton={false} render={<Link href="/utilisateurs/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvel utilisateur
            </Button>
          </Can>
        }
      />

      <div className="flex flex-wrap gap-4">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Rôle</span>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? ALL)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les rôles</SelectItem>
              {(roles ?? []).map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Statut</span>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
              {Object.entries(userStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        getRowKey={(u) => u.id}
        emptyLabel="Aucun utilisateur ne correspond à ce filtre."
        rowActions={(u) => (
          <Can permission={PERMISSIONS.USERS_UPDATE}>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/utilisateurs/${u.id}/modifier`} />}
            >
              Modifier
            </Button>
          </Can>
        )}
      />
    </div>
  );
}
