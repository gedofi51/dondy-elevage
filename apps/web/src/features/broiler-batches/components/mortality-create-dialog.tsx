'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MortalityForm } from './mortality-form';

export function MortalityCreateDialog({
  batchId,
  open,
  onOpenChange,
}: {
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Déclarer une mortalité</DialogTitle>
        </DialogHeader>
        <MortalityForm batchId={batchId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
