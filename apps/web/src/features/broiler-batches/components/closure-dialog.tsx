'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { useBatchProfitability, useCloseBroilerBatch } from '../hooks';

function fcfa(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}

/** Contrairement à ConfirmDialog (description: string), la clôture doit
 * afficher le résumé structuré renvoyé par l'API avant une action
 * irréversible — GET /:id/profitability (même forme que la réponse de
 * POST /:id/cloturer) sert de prévisualisation, disponible même avant que
 * la bande soit clôturable. */
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
  const { data: summary, isLoading } = useBatchProfitability(batchId);
  const closeMutation = useCloseBroilerBatch(batchId);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await closeMutation.mutateAsync();
      toast.success('Bande clôturée.');
      onOpenChange(false);
      router.push(`/poulets-chair/${batchId}`);
    } catch {
      toast.error('Échec de la clôture — vérifiez qu’aucun sujet ne reste vivant/disponible.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clôturer la bande</DialogTitle>
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
                <StatusBadge label="Mortalité cohérente" tone="success" />
              ) : (
                <StatusBadge label="Écart de mortalité détecté" tone="destructive" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Mortalité cumulée</span>
              <span className="text-right">{summary.production.cumulativeMortality}</span>
              <span className="text-muted-foreground">Vendus</span>
              <span className="text-right">{summary.production.soldCount}</span>
              <span className="text-muted-foreground">IC (indice de consommation)</span>
              <span className="text-right">{summary.performance.feedConversionRatio.toFixed(2)}</span>
              <span className="text-muted-foreground">Marge brute</span>
              <span className="text-right">{fcfa(summary.finances.grossMarginFcfa)}</span>
              <span className="text-muted-foreground">Taux de rentabilité</span>
              <span className="text-right">{summary.finances.profitabilityRate.toFixed(1)} %</span>
            </div>
            {!summary.coherence.isCoherent ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Le total de mortalité quotidienne ({summary.coherence.dailyRecordMortalityTotal}) ne
                correspond pas au détail par cause ({summary.coherence.detailedMortalityTotal}). La
                clôture reste possible, mais vérifiez la saisie.
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
