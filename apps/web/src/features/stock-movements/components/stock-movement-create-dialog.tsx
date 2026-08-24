'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StockMovementForm } from './stock-movement-form';

export function StockMovementCreateDialog({
  itemId,
  open,
  onOpenChange,
}: {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau mouvement</DialogTitle>
        </DialogHeader>
        <StockMovementForm itemId={itemId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
