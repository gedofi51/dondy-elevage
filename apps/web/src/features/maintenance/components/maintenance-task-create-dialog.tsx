'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaintenanceTaskForm } from './maintenance-task-form';

export function MaintenanceTaskCreateDialog({
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
          <DialogTitle>Nouvelle tâche corrective/conditionnelle</DialogTitle>
        </DialogHeader>
        <MaintenanceTaskForm assetId={assetId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
