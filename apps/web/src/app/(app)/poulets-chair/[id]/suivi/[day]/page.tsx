import { DailyRecordView } from './daily-record-view';

export default async function DailyRecordPage(props: PageProps<'/poulets-chair/[id]/suivi/[day]'>) {
  const { id, day } = await props.params;
  return <DailyRecordView batchId={id} day={Number(day)} />;
}
