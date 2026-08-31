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
import { useCancelEmployeeTask } from '../hooks';
import {
  cancelEmployeeTaskSchema,
  type CancelEmployeeTaskFormInput,
  type CancelEmployeeTaskFormValues,
} from '../schemas';

/**
 * Miroir de CancelTaskDialog (features/maintenance, Phase 17-20) — plus
 * proche du besoin que attendance-dialog.tsx (pas de branchement POST/
 * PATCH ici, un seul champ). Écart volontaire au précédent Maintenance :
 * `cancelReason` y est optionnel (API ET formulaire) ; ici la règle UI
 * explicite du Lot 6c l'impose côté formulaire (voir schemas.ts) sans
 * toucher au DTO API, resté optionnel côté serveur.
 */
export function CancelEmployeeTaskDialog({
  employeeId,
  taskId,
  open,
  onOpenChange,
}: {
  employeeId: string;
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancelMutation = useCancelEmployeeTask(employeeId, taskId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CancelEmployeeTaskFormInput, unknown, CancelEmployeeTaskFormValues>({
    resolver: zodResolver(cancelEmployeeTaskSchema),
  });

  async function onSubmit(values: CancelEmployeeTaskFormValues) {
    try {
      await cancelMutation.mutateAsync({ cancelReason: values.cancelReason });
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
            {errors.cancelReason ? (
              <p className="text-sm text-destructive">{errors.cancelReason.message}</p>
            ) : null}
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
