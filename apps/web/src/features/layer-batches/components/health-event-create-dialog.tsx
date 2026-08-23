'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HealthEventForm } from './health-event-form';

export function HealthEventCreateDialog({
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enregistrer un événement sanitaire</DialogTitle>
        </DialogHeader>
        <HealthEventForm batchId={batchId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
