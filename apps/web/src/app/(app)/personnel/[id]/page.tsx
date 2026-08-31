import { EmployeeDetailView } from './employee-detail-view';

export default async function EmployeeDetailPage(props: PageProps<'/personnel/[id]'>) {
  const { id } = await props.params;
  return <EmployeeDetailView employeeId={id} />;
}
