import { AssetDetailView } from './asset-detail-view';

export default async function AssetDetailPage(props: PageProps<'/patrimoine/[id]'>) {
  const { id } = await props.params;
  return <AssetDetailView assetId={id} />;
}
