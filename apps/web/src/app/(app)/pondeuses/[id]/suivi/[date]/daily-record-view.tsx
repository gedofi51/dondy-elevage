'use client';

import { PageHeader } from '@/components/shared/page-header';
import { ApiError } from '@/lib/api/client';
import { DailyRecordForm } from '@/features/layer-batches/components/daily-record-form';
import { useLayerBatch, useLayerDailyRecord, useLayerDailyRecords } from '@/features/layer-batches/hooks';
import { computeSuggestedHenCount } from '@/features/layer-batches/hen-count';

/** Architecture create-or-edit par date, sans précédent côté Broiler (45
 * lignes pré-générées) ni Eau (toujours POST) — voir plan Phase 12,
 * section D. Un 404 sur useLayerDailyRecord est l'état NORMAL "pas encore
 * saisi ce jour-là" (formulaire de création), pas une erreur ; toute autre
 * erreur (403/500) affiche un état d'erreur explicite plutôt qu'un
 * formulaire vide silencieux. */
export function DailyRecordView({ batchId, date }: { batchId: string; date: string }) {
  const { data: batch, isLoading: batchLoading } = useLayerBatch(batchId);
  const { data: records } = useLayerDailyRecords(batchId);
  const { data: record, isLoading: recordLoading, error } = useLayerDailyRecord(batchId, date);

  if (batchLoading || recordLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const isNotFound = error instanceof ApiError && error.status === 404;
  if (error && !isNotFound) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Suivi journalier" />
        <p className="text-sm text-destructive">
          Une erreur est survenue lors du chargement de cette journée — réessayez.
        </p>
      </div>
    );
  }

  const suggestedHenCount = computeSuggestedHenCount(records, batch.initialQuantity, date);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Suivi journalier — ${new Date(date).toLocaleDateString('fr-FR')}`}
        description={isNotFound ? 'Nouvelle journée' : 'Correction d’une journée existante'}
      />
      <div className="max-w-3xl">
        <DailyRecordForm
          batchId={batchId}
          date={date}
          existing={isNotFound ? null : (record ?? null)}
          suggestedHenCount={suggestedHenCount}
        />
      </div>
    </div>
  );
}
