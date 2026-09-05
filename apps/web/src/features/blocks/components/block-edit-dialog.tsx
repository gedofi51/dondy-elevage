'use client';

import type { Block } from '@dondy-elevage/shared-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BlockForm } from './block-form';

export function BlockEditDialog({
  block,
  open,
  onOpenChange,
}: {
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le bloc</DialogTitle>
        </DialogHeader>
        {block ? (
          <BlockForm buildingId={block.buildingId} block={block} onSuccess={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
