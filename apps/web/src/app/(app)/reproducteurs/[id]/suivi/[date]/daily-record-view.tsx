'use client';

import { PageHeader } from '@/components/shared/page-header';
import { ApiError } from '@/lib/api/client';
import { DailyRecordForm } from '@/features/breeder-batches/components/daily-record-form';
import { useBreederDailyRecord } from '@/features/breeder-batches/hooks';

/** Même architecture create-or-edit par date que Pondeuses (Phase 12,
 * sans précédent Broiler/Eau) — un 404 est l'état NORMAL "pas encore saisi
 * ce jour-là" (formulaire de création), toute autre erreur affiche un état
 * explicite plutôt qu'un formulaire vide silencieux. Contrairement à Layer,
 * pas de suggestion d'effectif à recalculer (aucune formule de report
 * n'existe côté API pour BreederDailyRecord). */
export function DailyRecordView({ batchId, date }: { batchId: string; date: string }) {
  const { data: record, isLoading, error } = useBreederDailyRecord(batchId, date);

  if (isLoading) {
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Suivi journalier — ${new Date(date).toLocaleDateString('fr-FR')}`}
        description={isNotFound ? 'Nouvelle journée' : 'Correction d’une journée existante'}
      />
      <div className="max-w-2xl">
        <DailyRecordForm batchId={batchId} date={date} existing={isNotFound ? null : (record ?? null)} />
      </div>
    </div>
  );
}
