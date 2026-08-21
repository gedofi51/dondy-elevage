import { SellWaterView } from './sell-water-view';

export default async function SellWaterPage(props: PageProps<'/points-eau/[id]/vendre'>) {
  const { id } = await props.params;
  return <SellWaterView waterPointId={id} />;
}
