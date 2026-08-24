'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { Incubator } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useDeleteIncubator, useIncubators } from '@/features/incubators/hooks';

export default function IncubatorsListPage() {
  const { data, isLoading } = useIncubators();
  const deleteMutation = useDeleteIncubator();
  const [toDelete, setToDelete] = useState<Incubator | null>(null);

  async function handleConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      toast.success('Couveuse supprimée.');
    } catch (err) {
      // Incubators.remove() ne vérifie pas l'existence de lots d'incubation
      // liés avant suppression — un 409 propre n'est pas garanti, message
      // de repli explicite (voir DETTE_TECHNIQUE.md Phase 13).
      toast.error(
        err instanceof ApiError
          ? extractMessage(
              err.body,
              'Suppression impossible — cette couveuse est peut-être utilisée par un lot d’incubation.',
            )
          : 'Suppression impossible — cette couveuse est peut-être utilisée par un lot d’incubation.',
      );
    } finally {
      setToDelete(null);
    }
  }

  const columns: DataTableColumn<Incubator>[] = [
    { key: 'name', header: 'Nom', render: (i) => i.name },
    {
      key: 'capacity',
      header: 'Capacité',
      render: (i) => (i.capacityEggs != null ? `${i.capacityEggs.toLocaleString('fr-FR')} œufs` : '—'),
    },
    { key: 'notes', header: 'Notes', render: (i) => i.notes ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Couveuses"
        description="Référentiel des couveuses de la ferme."
        action={
          <Can permission={PERMISSIONS.INCUBATORS_CREATE}>
            <Button nativeButton={false} render={<Link href="/couveuses/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvelle couveuse
            </Button>
          </Can>
        }
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowKey={(i) => i.id}
        emptyLabel="Aucune couveuse pour le moment."
        rowActions={(i) => (
          <div className="flex justify-end gap-1">
            <Can permission={PERMISSIONS.INCUBATORS_UPDATE}>
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<Link href={`/couveuses/${i.id}/modifier`} />}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
            <Can permission={PERMISSIONS.INCUBATORS_DELETE}>
              <Button variant="outline" size="icon" onClick={() => setToDelete(i)}>
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
        title="Supprimer cette couveuse ?"
        description={toDelete ? `« ${toDelete.name} » sera définitivement supprimée.` : undefined}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
