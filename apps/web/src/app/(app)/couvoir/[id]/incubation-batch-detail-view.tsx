'use client';

import Link from 'next/link';
import { Pencil, Shuffle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useIncubationBatch, useIncubationBatchProfitability } from '@/features/incubation-batches/hooks';
import { incubationBatchStatusConfig } from '@/features/incubation-batches/components/incubation-batch-table';
import {
  computeEmbryonicMortalityRatePercent,
  computeFertileEggs,
  computeFertilityRatePercent,
  computeHatchRatePercent,
  computeInfectedRatePercent,
} from '@/features/incubation-batches/kpi';
import { useBreederBatch } from '@/features/breeder-batches/hooks';
import { useIncubator } from '@/features/incubators/hooks';
import { useBatchLineageByIncubation } from '@/features/batch-lineage/hooks';
import { computeAvailableChicks } from '@/features/batch-lineage/available-chicks';
import { LineageTable } from '@/features/batch-lineage/components/lineage-table';

export function IncubationBatchDetailView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useIncubationBatch(batchId);
  const { data: profitability } = useIncubationBatchProfitability(batchId);
  const { data: breederBatch } = useBreederBatch(batch?.breederBatchId ?? '');
  const { data: incubator } = useIncubator(batch?.incubatorId ?? '');
  const { data: lineageRows, isLoading: lineageLoading } = useBatchLineageByIncubation(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  // Clôture/annulation différées cette phase (voir DETTE_TECHNIQUE.md
  // Phase 13) — pas de bouton Clôturer, garde isBatchOpen appliquée
  // défensivement sur Modifier (même raisonnement que Reproducteurs).
  const isBatchOpen = batch.status !== 'CLOTURE' && batch.status !== 'ANNULEE';
  const bilanSaisi = batch.chicksHatched !== null;
  const available = computeAvailableChicks(batch.chicksHatched, lineageRows);
  const fertileEggs = bilanSaisi ? computeFertileEggs(batch.eggCount, batch.eggsInfertile ?? 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={batch.code}
        description={`Lot reproducteur ${breederBatch?.code ?? '…'} · couveuse ${incubator?.name ?? '…'} · mise en incubation le ${new Date(batch.incubationStartDate).toLocaleDateString('fr-FR')}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={incubationBatchStatusConfig[batch.status].label}
              tone={incubationBatchStatusConfig[batch.status].tone}
            />
            <Can permission={PERMISSIONS.ORIENTATION_CREATE}>
              {bilanSaisi && available > 0 ? (
                <Button nativeButton={false} render={<Link href={`/couvoir/${batchId}/orienter`} />}>
                  <Shuffle className="h-4 w-4" aria-hidden="true" />
                  Orienter les poussins
                </Button>
              ) : null}
            </Can>
            <Can permission={PERMISSIONS.INCUBATION_BATCHES_UPDATE}>
              {isBatchOpen ? (
                <Button
                  variant="outline"
                  size="icon"
                  nativeButton={false}
                  render={<Link href={`/couvoir/${batchId}/modifier`} />}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </Can>
          </div>
        }
      />

      {!bilanSaisi ? (
        <p className="text-sm text-muted-foreground">
          Bilan de mirage-éclosion non saisi — utilisez « Modifier » pour le renseigner.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Taux d’éclosion"
          value={bilanSaisi ? `${computeHatchRatePercent(batch.chicksHatched!, batch.eggCount).toFixed(1)} %` : '—'}
        />
        <KpiCard
          label="Taux de fécondité"
          value={bilanSaisi ? `${computeFertilityRatePercent(fertileEggs, batch.eggCount).toFixed(1)} %` : '—'}
        />
        <KpiCard
          label="Mortalité embryonnaire"
          value={
            bilanSaisi
              ? `${computeEmbryonicMortalityRatePercent(batch.embryonicMortality ?? 0, fertileEggs).toFixed(1)} %`
              : '—'
          }
        />
        <KpiCard
          label="Taux d’infection"
          value={bilanSaisi ? `${computeInfectedRatePercent(batch.eggsInfected ?? 0, batch.eggCount).toFixed(1)} %` : '—'}
        />
      </div>

      {profitability ? (
        <Card>
          <CardHeader>
            <CardTitle>Rentabilité</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <span className="text-muted-foreground">Coût total</span>
            <span className="text-right sm:col-span-3">
              {profitability.totalExpensesFcfa.toLocaleString('fr-FR')} FCFA
            </span>
            <span className="text-muted-foreground">Chiffre d’affaires (ventes poussins)</span>
            <span className="text-right sm:col-span-3">
              {profitability.revenueFcfa.toLocaleString('fr-FR')} FCFA
            </span>
            <span className="text-muted-foreground">Marge brute</span>
            <span className="text-right sm:col-span-3">
              {profitability.grossMarginFcfa.toLocaleString('fr-FR')} FCFA
            </span>
            <span className="text-muted-foreground">Coût par poussin éclos</span>
            <span className="text-right sm:col-span-3">
              {profitability.costPerChickHatchedFcfa.toFixed(2)} FCFA
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-primary">Filiation</h2>
        <Can
          permission={PERMISSIONS.BATCH_LINEAGE_READ}
          fallback={<p className="text-sm text-muted-foreground">Non disponible avec votre rôle actuel.</p>}
        >
          <LineageTable data={lineageRows} isLoading={lineageLoading} />
        </Can>
      </div>
    </div>
  );
}
