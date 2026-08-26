'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WaterReadingForm } from './water-reading-form';

export function WaterReadingCreateDialog({
  assetId,
  open,
  onOpenChange,
}: {
  assetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau relevé — Eau</DialogTitle>
        </DialogHeader>
        <WaterReadingForm assetId={assetId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
