import { PageHeader } from '@/components/shared/page-header';
import { AssetForm } from '@/features/assets/components/asset-form';

export default function NewAssetPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvel actif" />
      <div className="max-w-2xl">
        <AssetForm />
      </div>
    </div>
  );
}
