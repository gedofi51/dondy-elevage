'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Payroll } from '@dondy-elevage/shared-types';
import { PayrollForm } from './payroll-form';

interface PayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  payroll?: Payroll;
}

export function PayrollDialog({ open, onOpenChange, employeeId, payroll }: PayrollDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payroll ? 'Modifier le relevé' : 'Nouveau relevé de paie'}</DialogTitle>
        </DialogHeader>
        <PayrollForm employeeId={employeeId} payroll={payroll} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
