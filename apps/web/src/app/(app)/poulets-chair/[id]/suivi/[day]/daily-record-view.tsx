'use client';

import { PageHeader } from '@/components/shared/page-header';
import { DailyRecordForm } from '@/features/broiler-batches/components/daily-record-form';
import { useDailyRecord } from '@/features/broiler-batches/hooks';
import { DAILY_CYCLE_LENGTH, isDayNumberInCycle } from '@/features/broiler-batches/day-number';

export function DailyRecordView({ batchId, day }: { batchId: string; day: number }) {
  if (!isDayNumberInCycle(day)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Suivi quotidien" />
        <p className="text-sm text-destructive">
          Jour invalide — doit être compris entre 1 et {DAILY_CYCLE_LENGTH}.
        </p>
      </div>
    );
  }

  return <DailyRecordViewLoaded batchId={batchId} day={day} />;
}

function DailyRecordViewLoaded({ batchId, day }: { batchId: string; day: number }) {
  const { data: record, isLoading } = useDailyRecord(batchId, day);

  if (isLoading || !record) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Suivi quotidien — Jour ${day}`}
        description={new Date(record.date).toLocaleDateString('fr-FR')}
      />
      <div className="max-w-3xl">
        <DailyRecordForm batchId={batchId} record={record} />
      </div>
    </div>
  );
}
