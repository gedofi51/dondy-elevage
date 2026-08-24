'use client';

import Link from 'next/link';
import { Pencil, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useBreederBatch, useBreederDailyRecords } from '@/features/breeder-batches/hooks';
import { breederBatchStatusConfig } from '@/features/breeder-batches/components/breeder-batch-table';
import { DailyRecordsTable } from '@/features/breeder-batches/components/daily-records-table';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BreederBatchDetailView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useBreederBatch(batchId);
  const { data: dailyRecords, isLoading: dailyLoading } = useBreederDailyRecords(batchId);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  // Clôture/annulation différées cette phase (aucun endpoint testé e2e,
  // voir DETTE_TECHNIQUE.md Phase 13) — pas de bouton Clôturer construit,
  // mais la garde isBatchOpen reste appliquée défensivement sur Modifier :
  // ces statuts restent atteignables hors UI et un statut terminal en base
  // rendrait le Select statut du formulaire d'édition vide (hors
  // BREEDER_BATCH_EDITABLE_STATUSES), bloquant silencieusement la
  // soumission — même raisonnement que Layer/Broiler.
  const isBatchOpen = batch.status !== 'CLOTURE' && batch.status !== 'ANNULEE';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={batch.code}
        description={`Constitué le ${new Date(batch.constitutionDate).toLocaleDateString('fr-FR')}${
          batch.strain ? ` · ${batch.strain}` : ''
        }`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={breederBatchStatusConfig[batch.status].label}
              tone={breederBatchStatusConfig[batch.status].tone}
            />
            <Can permission={PERMISSIONS.BREEDER_DAILY_RECORDS_READ}>
              {isBatchOpen ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/reproducteurs/${batchId}/suivi/${todayIsoDate()}`} />}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Saisir aujourd’hui
                </Button>
              ) : (
                <Button variant="outline" disabled title="Lot clôturé ou annulé">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Saisir aujourd’hui
                </Button>
              )}
            </Can>
            <Can permission={PERMISSIONS.BREEDER_BATCHES_UPDATE}>
              {isBatchOpen ? (
                <Button
                  variant="outline"
                  size="icon"
                  nativeButton={false}
                  render={<Link href={`/reproducteurs/${batchId}/modifier`} />}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </Can>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Effectif femelles" value={batch.femaleCount} unit="femelles" />
        <KpiCard label="Effectif mâles" value={batch.maleCount} unit="mâles" />
        <KpiCard
          label="Œufs fécondés disponibles"
          value={batch.availableFertileEggs}
          unit="œufs"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-primary">Suivi journalier</h2>
        <Can
          permission={PERMISSIONS.BREEDER_DAILY_RECORDS_READ}
          fallback={<p className="text-sm text-muted-foreground">Non disponible avec votre rôle actuel.</p>}
        >
          <DailyRecordsTable batchId={batchId} data={dailyRecords} isLoading={dailyLoading} />
        </Can>
      </div>
    </div>
  );
}
