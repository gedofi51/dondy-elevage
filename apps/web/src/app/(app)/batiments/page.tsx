'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { Building } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useBuildings, useDeleteBuilding } from '@/features/buildings/hooks';
import { buildingTypeOptions } from '@/features/buildings/schemas';

const typeLabelByValue = new Map(buildingTypeOptions.map((o) => [o.value, o.label]));

export default function BuildingsListPage() {
  const { data, isLoading } = useBuildings();
  const deleteMutation = useDeleteBuilding();
  const [toDelete, setToDelete] = useState<Building | null>(null);

  async function handleConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      toast.success('Bâtiment supprimé.');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Suppression impossible.')
          : 'Suppression impossible.',
      );
    } finally {
      setToDelete(null);
    }
  }

  const columns: DataTableColumn<Building>[] = [
    {
      key: 'name',
      header: 'Nom',
      render: (b) => (
        <Link href={`/batiments/${b.id}`} className="font-medium text-primary hover:underline">
          {b.name}
        </Link>
      ),
    },
    { key: 'type', header: 'Type', render: (b) => typeLabelByValue.get(b.type) ?? b.type },
    {
      key: 'capacity',
      header: 'Capacité',
      render: (b) => (b.capacity != null ? b.capacity.toLocaleString('fr-FR') : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bâtiments"
        description="Référentiel des bâtiments de la ferme (poulaillers, couvoir, stockage…) et de leurs blocs."
        action={
          <Can permission={PERMISSIONS.BUILDINGS_CREATE}>
            <Button nativeButton={false} render={<Link href="/batiments/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau bâtiment
            </Button>
          </Can>
        }
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowKey={(b) => b.id}
        emptyLabel="Aucun bâtiment pour le moment."
        rowActions={(b) => (
          <div className="flex justify-end gap-1">
            <Can permission={PERMISSIONS.BUILDINGS_UPDATE}>
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<Link href={`/batiments/${b.id}/modifier`} />}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
            <Can permission={PERMISSIONS.BUILDINGS_DELETE}>
              <Button variant="outline" size="icon" onClick={() => setToDelete(b)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer ce bâtiment ?"
        description={
          toDelete
            ? `« ${toDelete.name} » sera définitivement supprimé. Impossible si une bande ou un employé y est rattaché.`
            : undefined
        }
        confirmLabel="Supprimer"
      />
    </div>
  );
}
