'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SolarReadingForm } from './solar-reading-form';

export function SolarReadingCreateDialog({
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
          <DialogTitle>Nouveau relevé — Solaire</DialogTitle>
        </DialogHeader>
        <SolarReadingForm assetId={assetId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
