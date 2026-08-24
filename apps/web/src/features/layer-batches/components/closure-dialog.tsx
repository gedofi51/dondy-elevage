'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { useCloseLayerBatch, useLayerBatchProfitability } from '../hooks';

function fcfa(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}

/** Contrairement à ConfirmDialog (description: string), la clôture doit
 * afficher le résumé structuré renvoyé par l'API avant une action
 * irréversible — GET /:id/profitability (même forme que la réponse de
 * POST /:id/cloturer) sert de prévisualisation, disponible à tout moment
 * sur un lot actif. Contrairement à Broiler, LayerBatchesService.close()
 * n'a AUCUNE garde (ni statut, ni effectif restant) : pas de message
 * d'erreur spécifique à un scénario métier, un texte neutre suffit. */
export function ClosureDialog({
  batchId,
  open,
  onOpenChange,
}: {
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: summary, isLoading } = useLayerBatchProfitability(batchId);
  const closeMutation = useCloseLayerBatch(batchId);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await closeMutation.mutateAsync();
      toast.success('Lot clôturé.');
      onOpenChange(false);
      router.push(`/pondeuses/${batchId}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la clôture.')
          : 'Échec de la clôture.',
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clôturer le lot</DialogTitle>
          <DialogDescription>
            Action irréversible — vérifiez le résumé avant de confirmer.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !summary ? (
          <p className="text-sm text-muted-foreground">Chargement du résumé…</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              {summary.coherence.isCoherent ? (
                <StatusBadge label="Effectif cohérent" tone="success" />
              ) : (
                <StatusBadge label="Écart d’effectif détecté" tone="destructive" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Effectif actuel</span>
              <span className="text-right">{summary.production.currentHeadcount.toLocaleString('fr-FR')}</span>
              <span className="text-muted-foreground">Œufs pondus (cumul)</span>
              <span className="text-right">{summary.production.cumulativeEggsLaid.toLocaleString('fr-FR')}</span>
              <span className="text-muted-foreground">Œufs vendus (cumul)</span>
              <span className="text-right">{summary.production.cumulativeEggsSold.toLocaleString('fr-FR')}</span>
              <span className="text-muted-foreground">Taux de ponte moyen</span>
              <span className="text-right">{summary.production.averageLayingRatePercent.toFixed(1)} %</span>
              <span className="text-muted-foreground">Stock d’œufs restant</span>
              <span className="text-right">{summary.stock.remainingEggStock.toLocaleString('fr-FR')}</span>
              <span className="text-muted-foreground">Marge brute</span>
              <span className="text-right">{fcfa(summary.finances.grossMarginFcfa)}</span>
            </div>
            {summary.stock.remainingEggStock > 0 ? (
              <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-warning">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Un stock d’œufs non nul subsistera après clôture — non bloquant, mais à vérifier.
              </p>
            ) : null}
            {!summary.coherence.isCoherent ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Le dernier effectif saisi ({summary.coherence.lastRecordedHenCount ?? '—'}) ne correspond
                pas à l’effectif calculé ({summary.coherence.computedHeadcount}). La clôture reste
                possible, mais vérifiez la saisie.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-success">
                <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                Aucun écart de cohérence détecté.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={confirming || isLoading}>
            {confirming ? 'Clôture…' : 'Confirmer la clôture'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
