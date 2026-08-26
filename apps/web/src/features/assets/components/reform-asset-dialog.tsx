'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import type { AssetWithComputed } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useReformAsset } from '../hooks';
import { reformAssetSchema, type ReformAssetFormInput, type ReformAssetFormValues } from '../schemas';

/** Réforme = statut terminal (voir DETTE_TECHNIQUE.md Phase 16) : résumé
 * de l'état déjà connu (VNC/statut actuels), pas de recalcul de la VNC à
 * la date de réforme côté client — l'API recalculera l'état réel au
 * prochain chargement de la fiche. */
export function ReformAssetDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: AssetWithComputed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reformMutation = useReformAsset(asset.id);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ReformAssetFormInput, unknown, ReformAssetFormValues>({
    resolver: zodResolver(reformAssetSchema),
  });

  async function onSubmit(values: ReformAssetFormValues) {
    try {
      await reformMutation.mutateAsync({
        reformDate: values.reformDate || undefined,
        reformReason: values.reformReason || undefined,
      });
      toast.success('Actif réformé.');
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la réforme.')
          : 'Échec de la réforme.',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Réformer l’actif</DialogTitle>
          <DialogDescription>
            Action irréversible — l’actif ne pourra plus recevoir de nouveau plan de maintenance,
            relevé d’infrastructure ni dépense après réforme.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <span className="text-muted-foreground">Valeur nette comptable actuelle</span>
          <span className="text-right">{asset.netBookValueFcfa.toLocaleString('fr-FR')} FCFA</span>
          <span className="text-muted-foreground">Coût total de possession</span>
          <span className="text-right">{asset.tcoFcfa.toLocaleString('fr-FR')} FCFA</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="reform-date">Date de réforme</Label>
            <Input id="reform-date" type="date" {...register('reformDate')} />
            <p className="text-xs text-muted-foreground">Laissé vide : aujourd’hui.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reform-reason">Motif</Label>
            <Textarea id="reform-reason" {...register('reformReason')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? 'Réforme…' : 'Confirmer la réforme'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
