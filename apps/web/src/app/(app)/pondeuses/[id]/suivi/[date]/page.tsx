import { DailyRecordView } from './daily-record-view';

export default async function DailyRecordPage(props: PageProps<'/pondeuses/[id]/suivi/[date]'>) {
  const { id, date } = await props.params;
  return <DailyRecordView batchId={id} date={date} />;
}
