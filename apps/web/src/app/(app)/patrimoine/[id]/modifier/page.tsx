import { EditAssetView } from './edit-asset-view';

export default async function EditAssetPage(props: PageProps<'/patrimoine/[id]/modifier'>) {
  const { id } = await props.params;
  return <EditAssetView assetId={id} />;
}
