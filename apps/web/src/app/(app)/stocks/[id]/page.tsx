import { ItemDetailView } from './item-detail-view';

export default async function ItemDetailPage(props: PageProps<'/stocks/[id]'>) {
  const { id } = await props.params;
  return <ItemDetailView itemId={id} />;
}
