'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Attendance } from '@dondy-elevage/shared-types';
import { AttendanceForm } from './attendance-form';

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  date: string;
  existing: Attendance | null;
}

/** Wrapper Dialog+Form réutilisé par AttendanceCalendar (onglet Présence,
 * un employé) et AttendanceRegister (/pointage, tous les employés) — même
 * patron que HealthEventCreateDialog (features/broiler-batches). */
export function AttendanceDialog({ open, onOpenChange, employeeId, date, existing }: AttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pointage — {new Date(date).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</DialogTitle>
        </DialogHeader>
        <AttendanceForm
          employeeId={employeeId}
          date={date}
          existing={existing}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
