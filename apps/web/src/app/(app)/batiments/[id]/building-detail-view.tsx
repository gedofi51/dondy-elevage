'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { Block } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useBuilding } from '@/features/buildings/hooks';
import { buildingTypeOptions } from '@/features/buildings/schemas';
import { useBlocks, useDeleteBlock } from '@/features/blocks/hooks';
import { BlockCreateDialog } from '@/features/blocks/components/block-create-dialog';
import { BlockEditDialog } from '@/features/blocks/components/block-edit-dialog';

const typeLabelByValue = new Map(buildingTypeOptions.map((o) => [o.value, o.label]));

export function BuildingDetailView({ buildingId }: { buildingId: string }) {
  const { data: building, isLoading } = useBuilding(buildingId);
  const { data: allBlocks, isLoading: blocksLoading } = useBlocks();
  const deleteBlockMutation = useDeleteBlock();

  const blocks = useMemo(
    () => (allBlocks ?? []).filter((b) => b.buildingId === buildingId),
    [allBlocks, buildingId],
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<Block | null>(null);

  async function handleConfirmDeleteBlock() {
    if (!blockToDelete) return;
    try {
      await deleteBlockMutation.mutateAsync(blockToDelete.id);
      toast.success('Bloc supprimé.');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la suppression.')
          : 'Échec de la suppression.',
      );
    } finally {
      setBlockToDelete(null);
    }
  }

  if (isLoading || !building) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const columns: DataTableColumn<Block>[] = [
    { key: 'name', header: 'Nom', render: (b) => b.name },
    { key: 'code', header: 'Code', render: (b) => b.code ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={building.name}
        description={typeLabelByValue.get(building.type) ?? building.type}
        action={
          <Can permission={PERMISSIONS.BUILDINGS_UPDATE}>
            <Button
              variant="outline"
              size="icon"
              nativeButton={false}
              render={<Link href={`/batiments/${buildingId}/modifier`} />}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Can>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <span className="text-muted-foreground">Type</span>
          <span className="sm:col-span-2">{typeLabelByValue.get(building.type) ?? building.type}</span>
          <span className="text-muted-foreground">Capacité</span>
          <span className="sm:col-span-2">
            {building.capacity != null ? building.capacity.toLocaleString('fr-FR') : '—'}
          </span>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-primary">
            Blocs (subdivision optionnelle de ce bâtiment)
          </h2>
          <Can permission={PERMISSIONS.BUILDINGS_CREATE}>
            <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau bloc
            </Button>
          </Can>
        </div>
        <DataTable
          columns={columns}
          data={blocks}
          isLoading={blocksLoading}
          getRowKey={(b) => b.id}
          emptyLabel="Aucun bloc — les bandes peuvent être rattachées directement à ce bâtiment."
          rowActions={(b) => (
            <div className="flex justify-end gap-1">
              <Can permission={PERMISSIONS.BUILDINGS_UPDATE}>
                <Button variant="outline" size="icon" onClick={() => setEditingBlock(b)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
              <Can permission={PERMISSIONS.BUILDINGS_DELETE}>
                <Button variant="outline" size="icon" onClick={() => setBlockToDelete(b)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
            </div>
          )}
        />
      </section>

      <BlockCreateDialog buildingId={buildingId} open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <BlockEditDialog
        block={editingBlock}
        open={!!editingBlock}
        onOpenChange={(open) => !open && setEditingBlock(null)}
      />
      <ConfirmDialog
        open={!!blockToDelete}
        onOpenChange={(open) => !open && setBlockToDelete(null)}
        onConfirm={handleConfirmDeleteBlock}
        title="Supprimer ce bloc ?"
        description={
          blockToDelete
            ? `« ${blockToDelete.name} » sera définitivement supprimé. Les bandes qui l'utilisaient resteront rattachées au bâtiment, sans bloc précis.`
            : undefined
        }
        confirmLabel="Supprimer"
      />
    </div>
  );
}
