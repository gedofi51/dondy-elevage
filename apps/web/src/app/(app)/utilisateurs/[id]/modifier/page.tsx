import { EditUserView } from './edit-user-view';

export default async function EditUserPage(props: PageProps<'/utilisateurs/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditUserView userId={id} />;
}
