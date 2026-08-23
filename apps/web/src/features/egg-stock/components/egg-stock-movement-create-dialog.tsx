'use client';

import type { EggStockLotWithRemaining } from '@dondy-elevage/shared-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EggStockMovementForm } from './egg-stock-movement-form';

export function EggStockMovementCreateDialog({
  batchId,
  lots,
  open,
  onOpenChange,
}: {
  batchId: string;
  lots: EggStockLotWithRemaining[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Déclarer une perte</DialogTitle>
        </DialogHeader>
        <EggStockMovementForm batchId={batchId} lots={lots} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
