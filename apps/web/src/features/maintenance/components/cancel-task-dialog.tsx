'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCancelMaintenanceTask } from '../hooks';
import {
  cancelMaintenanceTaskSchema,
  type CancelMaintenanceTaskFormInput,
  type CancelMaintenanceTaskFormValues,
} from '../schemas';

export function CancelTaskDialog({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancelMutation = useCancelMaintenanceTask(taskId);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CancelMaintenanceTaskFormInput, unknown, CancelMaintenanceTaskFormValues>({
    resolver: zodResolver(cancelMaintenanceTaskSchema),
  });

  async function onSubmit(values: CancelMaintenanceTaskFormValues) {
    try {
      await cancelMutation.mutateAsync({ cancelReason: values.cancelReason || undefined });
      toast.success('Tâche annulée.');
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’annulation.')
          : 'Échec de l’annulation.',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler la tâche</DialogTitle>
          <DialogDescription>Action irréversible — la tâche passe au statut Annulée.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">Motif</Label>
            <Textarea id="cancel-reason" {...register('cancelReason')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Retour
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? 'Annulation…' : 'Confirmer l’annulation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
