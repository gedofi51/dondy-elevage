'use client';

import { PageHeader } from '@/components/shared/page-header';
import { AssetForm } from '@/features/assets/components/asset-form';
import { useAsset } from '@/features/assets/hooks';

export function EditAssetView({ assetId }: { assetId: string }) {
  const { data: asset, isLoading } = useAsset(assetId);

  if (isLoading || !asset) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${asset.code}`} />
      <div className="max-w-2xl">
        <AssetForm asset={asset} />
      </div>
    </div>
  );
}
