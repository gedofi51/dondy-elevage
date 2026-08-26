'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaintenanceInterventionForm } from './maintenance-intervention-form';

/** sm:max-w-xl (pas sm:max-w-md comme les autres dialogs de maintenance) —
 * accueille les lignes de pièces du useFieldArray, voir DETTE_TECHNIQUE.md
 * Phase 19. */
export function MaintenanceInterventionCreateDialog({
  assetId,
  taskId,
  open,
  onOpenChange,
}: {
  assetId: string;
  taskId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle intervention</DialogTitle>
        </DialogHeader>
        <MaintenanceInterventionForm
          assetId={assetId}
          taskId={taskId}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
