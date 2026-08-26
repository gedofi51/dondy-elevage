'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaintenancePlanForm } from './maintenance-plan-form';

export function MaintenancePlanCreateDialog({
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
          <DialogTitle>Nouveau plan de maintenance</DialogTitle>
        </DialogHeader>
        <MaintenancePlanForm assetId={assetId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
