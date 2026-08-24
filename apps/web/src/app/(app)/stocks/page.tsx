'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { Item } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useDeleteItem, useItems } from '@/features/items/hooks';
import { ItemTable } from '@/features/items/components/item-table';

export default function ItemsListPage() {
  const [filter, setFilter] = useState<'alerte' | 'tous'>('tous');
  const { data, isLoading } = useItems(filter === 'alerte' ? { belowThreshold: true } : undefined);
  const deleteMutation = useDeleteItem();
  const [toDelete, setToDelete] = useState<Item | null>(null);

  async function handleConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      toast.success('Article supprimé.');
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stocks"
        description="Catalogue des articles, seuils d’alerte et mouvements."
        action={
          <Can permission={PERMISSIONS.ITEMS_CREATE}>
            <Button nativeButton={false} render={<Link href="/stocks/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvel article
            </Button>
          </Can>
        }
      />

      {/* belowThreshold=true est un filtre SERVEUR réel (GET
          /items?belowThreshold=true), contrairement au toggle Actifs/Tous
          purement client des autres modules. */}
      <div className="flex gap-2">
        <Button variant={filter === 'tous' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('tous')}>
          Tous
        </Button>
        <Button
          variant={filter === 'alerte' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('alerte')}
        >
          En alerte
        </Button>
      </div>

      <ItemTable
        data={data}
        isLoading={isLoading}
        rowActions={(item) => (
          <Can permission={PERMISSIONS.ITEMS_DELETE}>
            <Button variant="outline" size="icon" onClick={() => setToDelete(item)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Can>
        )}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer cet article ?"
        description={toDelete ? `« ${toDelete.name} » sera définitivement supprimé.` : undefined}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
