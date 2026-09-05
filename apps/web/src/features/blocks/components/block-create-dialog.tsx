'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BlockForm } from './block-form';

export function BlockCreateDialog({
  buildingId,
  open,
  onOpenChange,
}: {
  buildingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau bloc</DialogTitle>
        </DialogHeader>
        <BlockForm buildingId={buildingId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
