'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NetworkReadingForm } from './network-reading-form';

export function NetworkReadingCreateDialog({
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
          <DialogTitle>Nouveau relevé — Réseau</DialogTitle>
        </DialogHeader>
        <NetworkReadingForm assetId={assetId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
