import { EditEmployeeView } from './edit-employee-view';

export default async function EditEmployeePage(props: PageProps<'/personnel/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditEmployeeView employeeId={id} />;
}
