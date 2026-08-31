'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EmployeeTaskWithComputed } from '@dondy-elevage/shared-types';
import { EmployeeTaskForm } from './employee-task-form';

interface EmployeeTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  /** Absent = « Nouvelle tâche », présent = « Modifier la tâche » — même
   * wrapper Dialog+Form réutilisé pour les deux cas (voir
   * attendance-dialog.tsx, Lot 6b, même esprit). */
  task?: EmployeeTaskWithComputed;
}

export function EmployeeTaskDialog({ open, onOpenChange, employeeId, task }: EmployeeTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
        </DialogHeader>
        <EmployeeTaskForm employeeId={employeeId} task={task} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
