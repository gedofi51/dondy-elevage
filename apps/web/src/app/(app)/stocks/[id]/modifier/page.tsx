import { EditItemView } from './edit-item-view';

export default async function EditItemPage(props: PageProps<'/stocks/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditItemView itemId={id} />;
}
